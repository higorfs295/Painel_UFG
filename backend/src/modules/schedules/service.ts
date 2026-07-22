// RF-29 — cronograma inteligente: o cenário se preenche sozinho a partir do que o aluno
// já declarou como CURSANDO (ENROLLED) ou SIMULADA (SIMULATED).
//
// Antes, montar a grade era redigitar nome, sigla, carga horária e cor de cada disciplina que
// já estava cadastrada em outro lugar do sistema. Agora o servidor deriva tudo isso da matriz
// do curso e o aluno só informa o que ele de fato tem em mãos: o código de horário do SIGAA.
import type { PrismaClient } from "@prisma/client";
import { badRequest } from "../../lib/errors.js";

/** Mesma paleta da grade no cliente — o servidor escolhe a cor para não deixar tudo igual. */
export const SCENARIO_COLORS = ["#6FB3E8", "#E9B45A", "#B08CFF", "#4FD6A9", "#E06C6C", "#8FA3B2"];

// Palavras que não ajudam a identificar a disciplina numa sigla de 6 letras.
const STOP = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em", "para", "com", "à", "i", "ii", "iii", "iv"]);

/**
 * Sigla sugerida: iniciais das palavras significativas + o algarismo romano final quando existe
 * ("Cálculo Diferencial e Integral II" -> "CDI-II"). Cai no código da disciplina se não sobrar nada.
 */
export function suggestSigla(name: string, code: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const roman = words.at(-1)?.toUpperCase() ?? "";
  const isRoman = /^(I|II|III|IV|V|VI)$/.test(roman);
  const core = (isRoman ? words.slice(0, -1) : words)
    .filter((w) => !STOP.has(w.toLowerCase()))
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 5);
  if (!core) return code.slice(0, 8);
  return isRoman ? `${core}-${roman}` : core;
}

/** Cores ainda livres primeiro; depois volta a girar a paleta. */
function pickColor(used: string[], index: number): string {
  const free = SCENARIO_COLORS.filter((c) => !used.includes(c));
  return free.length > 0
    ? free[index % free.length]!
    : SCENARIO_COLORS[index % SCENARIO_COLORS.length]!;
}

export type Candidate = {
  subjectId: string; code: string; name: string; hours: number;
  state: "ENROLLED" | "SIMULATED";
  term: string | null;
  sigla: string; color: string;      // sugestões — o aluno pode sobrescrever
  alreadyInScenario: boolean;
};

/**
 * Disciplinas do aluno elegíveis para entrar no cenário. Marca as que já estão lá (por código
 * ou sigla) em vez de escondê-las: o aluno vê a lista completa e entende por que uma está fora.
 */
export async function scenarioCandidates(
  prisma: PrismaClient, scenarioId: string, enrollmentId: string,
): Promise<Candidate[]> {
  const [rows, existing] = await Promise.all([
    prisma.subjectStatus.findMany({
      where: { enrollmentId, state: { in: ["ENROLLED", "SIMULATED"] } },
      select: {
        state: true, term: true,
        subject: { select: { id: true, code: true, name: true, hours: true, seq: true } },
      },
    }),
    prisma.scenarioDiscipline.findMany({
      where: { scenarioId }, select: { name: true, sigla: true, color: true },
    }),
  ]);

  // "já está no cenário" = mesmo nome OU mesma sigla (o aluno pode ter digitado à mão antes)
  const takenNames = new Set(existing.map((d) => d.name.trim().toLowerCase()));
  const takenSiglas = new Set(existing.map((d) => d.sigla.trim().toUpperCase()));
  const usedColors = existing.map((d) => d.color);

  // CURSANDO antes de SIMULADA (é o que o aluno vai montar primeiro), depois ordem da matriz
  const sorted = [...rows].sort((a, b) =>
    (a.state === b.state ? a.subject.seq - b.subject.seq : a.state === "ENROLLED" ? -1 : 1));

  return sorted.map((r, i) => {
    const sigla = suggestSigla(r.subject.name, r.subject.code);
    return {
      subjectId: r.subject.id,
      code: r.subject.code,
      name: r.subject.name,
      hours: r.subject.hours,
      state: r.state as "ENROLLED" | "SIMULATED",
      term: r.term,
      sigla,
      color: pickColor(usedColors, i),
      alreadyInScenario:
        takenNames.has(r.subject.name.trim().toLowerCase()) || takenSiglas.has(sigla.toUpperCase()),
    };
  });
}

export type BulkItem = {
  subjectId: string; sigaaCode?: string | undefined;
  sigla?: string | undefined; color?: string | undefined; docente?: string | undefined;
};

/**
 * Insere as disciplinas escolhidas no cenário. `validateCode` é injetado pela rota (o parser
 * SIGAA vive lá) para que este serviço não dependa de HTTP nem do formato do erro.
 *
 * Só aceita disciplinas do CURSO da matrícula e que o aluno tenha marcado como cursando/simulada:
 * o `subjectId` vem do cliente e não pode virar um atalho para inserir qualquer coisa.
 */
export async function bulkAddFromStatuses(
  prisma: PrismaClient, scenarioId: string, enrollmentId: string,
  items: BulkItem[], validateCode: (code: string) => string[],
) {
  if (items.length === 0) throw badRequest("nenhuma disciplina selecionada");

  const allowed = await prisma.subjectStatus.findMany({
    where: {
      enrollmentId,
      state: { in: ["ENROLLED", "SIMULATED"] },
      subjectId: { in: items.map((i) => i.subjectId) },
    },
    select: { subject: { select: { id: true, code: true, name: true, hours: true } } },
  });
  const byId = new Map(allowed.map((r) => [r.subject.id, r.subject]));

  const unknown = items.filter((i) => !byId.has(i.subjectId));
  if (unknown.length > 0)
    throw badRequest("disciplina fora da sua matrícula ou não marcada como cursando/simulada");

  const existing = await prisma.scenarioDiscipline.findMany({
    where: { scenarioId }, select: { name: true, color: true },
  });
  const taken = new Set(existing.map((d) => d.name.trim().toLowerCase()));
  const usedColors = existing.map((d) => d.color);

  const data = [];
  const skipped: string[] = [];
  for (const [i, item] of items.entries()) {
    const subject = byId.get(item.subjectId)!;
    if (taken.has(subject.name.trim().toLowerCase())) { skipped.push(subject.code); continue; }
    taken.add(subject.name.trim().toLowerCase());

    const sigaaCode = item.sigaaCode?.trim() ?? "";
    validateCode(sigaaCode);                        // lança SigaaError -> 400 com os tokens ruins
    const color = item.color ?? pickColor(usedColors, i);
    usedColors.push(color);
    data.push({
      scenarioId, name: subject.name, hours: subject.hours,
      sigla: item.sigla?.trim() || suggestSigla(subject.name, subject.code),
      docente: item.docente?.trim() || null,
      sigaaCode, color,
    });
  }

  if (data.length > 0) await prisma.scenarioDiscipline.createMany({ data });
  const disciplines = await prisma.scenarioDiscipline.findMany({ where: { scenarioId } });
  return { added: data.length, skipped, disciplines };
}
