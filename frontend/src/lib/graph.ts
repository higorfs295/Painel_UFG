// Grafo de requisitos (portado do protótipo, testado): status de disciplina e
// contagem transitiva de destravamentos para as recomendações.
export type Subject = {
  seq: number; code: string; name: string; hours: number;
  nucleus: "NC" | "NE"; groupOpt: number;
  pre: (number | string)[]; co: (number | string)[]; // string = milestoneKey (CH1..)
};
export type Milestone = { key: string; hours: number; description: string };
export type Status = "done" | "avail" | "co" | "lock";

export function statusOf(
  s: Subject, approved: Set<number>, totalHours: number,
  milestones: Milestone[], bySeq: Map<number, Subject>,
): Status {
  const preOK = (r: number | string) =>
    typeof r === "string" ? totalHours >= milestones.find(m => m.key === r)!.hours : approved.has(r);
  if (approved.has(s.seq)) return "done";
  if (s.pre.some(r => !preOK(r))) return "lock";
  const missCo = s.co.filter(r => typeof r !== "string" && !approved.has(r as number)) as number[];
  if (missCo.length) {
    const coBlocked = missCo.some(r => bySeq.get(r)!.pre.some(p => !preOK(p)));
    return coBlocked ? "lock" : "co";
  }
  return "avail";
}

export function buildDeps(subjects: Subject[]): Map<number, number[]> {
  const D = new Map<number, number[]>();
  for (const s of subjects)
    for (const r of [...s.pre, ...s.co])
      if (typeof r === "number") D.set(r, [...(D.get(r) ?? []), s.seq]);
  return D;
}

export function unlockCount(
  seq: number, deps: Map<number, number[]>, approved: Set<number>, bySeq: Map<number, Subject>,
): { ob: number; tot: number } {
  const seen = new Set<number>(); const q = [seq]; let ob = 0, tot = 0;
  while (q.length) {
    const x = q.pop()!;
    for (const d of deps.get(x) ?? []) if (!seen.has(d)) {
      seen.add(d); q.push(d);
      if (!approved.has(d)) { tot++; if (bySeq.get(d)!.groupOpt === 0) ob++; }
    }
  }
  return { ob, tot };
}
