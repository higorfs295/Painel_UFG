// Validador de matriz curricular — roda ANTES de importar um curso novo.
// Usa o MESMO schema zod do importador (fonte única de verdade) e acrescenta as checagens
// de integridade que o import não faz (refs órfãs seriam descartadas em silêncio!).
//
//   npx tsx scripts/validar-matriz.ts ../matrizes/matriz-engel-2023.json [outra.json ...]
//   npm run validar -- ../matrizes/*.json
//
// Sai com código != 0 se houver ERRO (avisos não bloqueiam).
import { readFileSync } from "node:fs";
import { matrizSchema, type Matriz } from "../src/domain/importCourse.js";

type Achado = { nivel: "ERRO" | "AVISO"; msg: string };

function validar(m: Matriz): Achado[] {
  const a: Achado[] = [];
  const seqs = new Set(m.subjects.map(s => s.seq));
  const mkeys = new Set(m.milestones.map(x => x.key));

  // seqs duplicados
  if (seqs.size !== m.subjects.length) {
    const vistos = new Set<number>();
    for (const s of m.subjects) {
      if (vistos.has(s.seq)) a.push({ nivel: "ERRO", msg: `seq ${s.seq} duplicado` });
      vistos.add(s.seq);
    }
  }

  // referências de pré/co: precisam existir (o importador descarta órfãs em silêncio)
  for (const s of m.subjects) {
    for (const [lista, tipo] of [[s.pre, "pré"], [s.co, "co"]] as const) {
      for (const r of lista) {
        if (typeof r === "number") {
          if (!seqs.has(r)) a.push({ nivel: "ERRO", msg: `seq ${s.seq} (${s.name}): ${tipo}-requisito ${r} não existe na matriz` });
          if (r === s.seq) a.push({ nivel: "ERRO", msg: `seq ${s.seq} (${s.name}): ${tipo}-requisito aponta para si mesma` });
        } else if (!mkeys.has(r)) {
          a.push({ nivel: "ERRO", msg: `seq ${s.seq} (${s.name}): marco "${r}" não está em milestones` });
        }
      }
    }
  }

  // ciclos no grafo de pré-requisitos (tornariam disciplinas eternamente bloqueadas)
  const pre = new Map(m.subjects.map(s => [s.seq, s.pre.filter((r): r is number => typeof r === "number")]));
  const cor = new Map<number, 0 | 1 | 2>();
  const ciclo: number[] = [];
  const dfs = (u: number, trilha: number[]): void => {
    cor.set(u, 1);
    for (const v of pre.get(u) ?? []) {
      if (!seqs.has(v)) continue;
      if (cor.get(v) === 1 && !ciclo.length) ciclo.push(...trilha, v);
      else if (!cor.get(v)) dfs(v, [...trilha, v]);
    }
    cor.set(u, 2);
  };
  for (const q of seqs) if (!cor.get(q)) dfs(q, [q]);
  if (ciclo.length) a.push({ nivel: "ERRO", msg: `ciclo de pré-requisitos: ${ciclo.join(" -> ")}` });

  // somas por núcleo devem bater com as composições declaradas
  const req = new Map(m.requirements.map(r => [r.key, r.hours]));
  const nc = m.subjects.filter(s => s.groupOpt === 0 && s.nucleus === "NC").reduce((t, s) => t + s.hours, 0);
  const neo = m.subjects.filter(s => s.groupOpt === 0 && s.nucleus === "NE").reduce((t, s) => t + s.hours, 0);
  const pool = m.subjects.filter(s => s.groupOpt > 0).reduce((t, s) => t + s.hours, 0);
  const compara = (rot: string, soma: number, chave: string) => {
    const exigido = req.get(chave);
    if (exigido === undefined) return a.push({ nivel: "AVISO", msg: `composição "${chave}" não declarada em requirements` });
    if (soma !== exigido) a.push({ nivel: "ERRO", msg: `${rot}: soma das disciplinas = ${soma}h, mas requirements.${chave} = ${exigido}h` });
  };
  compara("NC obrigatório", nc, "NC");
  compara("NE obrigatório", neo, "NEO");
  const opt = req.get("OPT") ?? 0;
  if (pool < opt) a.push({ nivel: "ERRO", msg: `pool de optativas (${pool}h) menor que o mínimo OPT (${opt}h) — impossível integralizar` });

  const somaReq = m.requirements.reduce((t, r) => t + r.hours, 0);
  if (somaReq !== m.totalHours)
    a.push({ nivel: "ERRO", msg: `totalHours = ${m.totalHours}, mas a soma das composições = ${somaReq}` });

  // sinais fracos
  for (const s of m.subjects) {
    if (s.hours <= 0) a.push({ nivel: "AVISO", msg: `seq ${s.seq} (${s.name}) com ${s.hours}h` });
    if (s.hours % 16 !== 0) a.push({ nivel: "AVISO", msg: `seq ${s.seq} (${s.name}): ${s.hours}h não é múltiplo de 16 (confira no PPC)` });
  }
  const usados = new Set(m.subjects.flatMap(s => [...s.pre, ...s.co]).filter((r): r is string => typeof r === "string"));
  for (const k of mkeys) if (!usados.has(k)) a.push({ nivel: "AVISO", msg: `marco "${k}" definido mas nunca usado` });

  return a;
}

const arquivos = process.argv.slice(2);
if (!arquivos.length) {
  console.error("uso: tsx scripts/validar-matriz.ts <matriz.json> [...]");
  process.exit(2);
}

let falhou = false;
for (const arq of arquivos) {
  console.log(`\n━━ ${arq}`);
  let bruto: unknown;
  try { bruto = JSON.parse(readFileSync(arq, "utf-8")); }
  catch (e) { console.error(`  ERRO: JSON inválido — ${(e as Error).message}`); falhou = true; continue; }

  const parsed = matrizSchema.safeParse(bruto);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 12))
      console.error(`  ERRO (schema): ${issue.path.join(".")}: ${issue.message}`);
    falhou = true; continue;
  }
  const m = parsed.data;
  const achados = validar(m);
  const erros = achados.filter(x => x.nivel === "ERRO");
  for (const x of achados) console.log(`  ${x.nivel === "ERRO" ? "✖" : "⚠"} ${x.msg}`);
  const ob = m.subjects.filter(s => s.groupOpt === 0).length;
  console.log(`  ✔ ${m.course.slug}: ${m.subjects.length} disciplinas (${ob} obrig + ${m.subjects.length - ob} opt), ` +
    `${m.milestones.length} marcos, total ${m.totalHours}h — ${erros.length ? `${erros.length} ERRO(S)` : "OK para importar"}`);
  if (erros.length) falhou = true;
}
process.exit(falhou ? 1 : 0);
