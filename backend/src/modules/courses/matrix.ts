// v12 — a matriz como ARQUIVO: exportar no mesmo formato da importação (o JSON de `matrizes/`)
// e pré-visualizar uma importação antes de gravar. Exportar → editar → reimportar vira o fluxo
// de manutenção de uma matriz sem mexer no banco à mão.
import type { PrismaClient } from "@prisma/client";
import { matrizSchema, type Matriz } from "../../domain/importCourse.js";

// ordem canônica das composições (a tabela não guarda ordem; o JSON exportado fica estável)
const REQ_ORDER = ["NC", "NEO", "OPT", "NL", "AC"];
const reqRank = (k: string) => { const i = REQ_ORDER.indexOf(k); return i === -1 ? REQ_ORDER.length : i; };

/** Reconstrói o JSON da matriz a partir do banco. Reimportá-lo não muda nada (idempotente). */
export async function exportCourse(prisma: PrismaClient, slug: string): Promise<Matriz | null> {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      requirements: true, milestones: true,
      subjects: {
        orderBy: { seq: "asc" },
        include: { requires: { include: { requiresSubject: { select: { seq: true } } } } },
      },
    },
  });
  if (!course) return null;

  const refs = (list: typeof course.subjects[number]["requires"], type: "PRE" | "CO") =>
    list.filter((r) => r.type === type)
      .map((r) => r.requiresSubject?.seq ?? r.milestoneKey)
      .filter((x): x is number | string => x !== null && x !== undefined)
      .sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));

  return {
    course: { slug: course.slug, name: course.name },
    totalHours: course.totalHours,
    requirements: [...course.requirements]
      .sort((a, b) => reqRank(a.key) - reqRank(b.key) || a.key.localeCompare(b.key))
      .map((r) => ({ key: r.key, label: r.label, hours: r.hours })),
    milestones: [...course.milestones]
      .sort((a, b) => a.hours - b.hours)
      .map((m) => ({ key: m.key, hours: m.hours, description: m.description })),
    subjects: course.subjects.map((s) => ({
      seq: s.seq, code: s.code, name: s.name, hours: s.hours, nucleus: s.nucleus, groupOpt: s.groupOpt,
      pre: refs(s.requires, "PRE"), co: refs(s.requires, "CO"),
    })),
  };
}

export type ImportPreview =
  | { valid: false; errors: { path: string; message: string }[] }
  | {
      valid: true;
      slug: string; name: string; exists: boolean; totalHours: number;
      counts: { subjects: number; requirements: number; milestones: number; requisites: number };
      /** seq novos, alterados e os que existem no banco mas não vieram no arquivo */
      added: number[]; changed: number[]; missing: number[];
      /** requisitos que apontam para um seq ou marco inexistente (a importação os ignora) */
      orphans: { seq: number; ref: number | string }[];
      warnings: string[];
    };

/** Valida e compara com o que já existe, sem gravar nada. */
export async function previewImport(prisma: PrismaClient, raw: unknown): Promise<ImportPreview> {
  const parsed = matrizSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  const m = parsed.data;
  const seqs = new Set(m.subjects.map((s) => s.seq));
  const milestoneKeys = new Set(m.milestones.map((x) => x.key));
  const warnings: string[] = [];

  const dupSeq = m.subjects.length - seqs.size;
  if (dupSeq > 0) warnings.push(`${dupSeq} disciplina(s) com "seq" repetido — a última de cada vence`);

  const orphans: { seq: number; ref: number | string }[] = [];
  let requisites = 0;
  for (const s of m.subjects) {
    for (const r of [...s.pre, ...s.co]) {
      requisites += 1;
      if (typeof r === "number" ? !seqs.has(r) : !milestoneKeys.has(r)) orphans.push({ seq: s.seq, ref: r });
    }
  }

  const existing = await prisma.course.findUnique({
    where: { slug: m.course.slug },
    select: { subjects: { select: { seq: true, code: true, name: true, hours: true, nucleus: true, groupOpt: true } } },
  });
  const added: number[] = [], changed: number[] = [], missing: number[] = [];
  if (existing) {
    const before = new Map(existing.subjects.map((s) => [s.seq, s]));
    for (const s of m.subjects) {
      const b = before.get(s.seq);
      if (!b) added.push(s.seq);
      else if (b.code !== s.code || b.name !== s.name || b.hours !== s.hours || b.nucleus !== s.nucleus || b.groupOpt !== s.groupOpt)
        changed.push(s.seq);
    }
    for (const seq of before.keys()) if (!seqs.has(seq)) missing.push(seq);
    if (missing.length)
      warnings.push(`${missing.length} disciplina(s) do banco não estão no arquivo — a importação não as remove`);
  }

  return {
    valid: true,
    slug: m.course.slug, name: m.course.name, exists: !!existing, totalHours: m.totalHours,
    counts: { subjects: m.subjects.length, requirements: m.requirements.length, milestones: m.milestones.length, requisites },
    added: existing ? added : m.subjects.map((s) => s.seq), changed, missing, orphans, warnings,
  };
}
