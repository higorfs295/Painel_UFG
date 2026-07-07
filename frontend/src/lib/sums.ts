// Somas por composição com teto de exibição em 100% (RF-05): valores reais preservados,
// percentuais travados — a UI mostra "+Xh além do mínimo".
import type { Subject } from "./graph";
export type Extra = { hours: number; category: "OPT" | "NL" | "AC" | "NONE"; done: boolean };
export type Requirement = { key: string; label: string; hours: number };

export function sums(subjects: Subject[], approved: Set<number>, extras: Extra[]) {
  let nc = 0, neo = 0, opt = 0;
  for (const s of subjects) if (approved.has(s.seq))
    s.groupOpt > 0 ? (opt += s.hours) : s.nucleus === "NC" ? (nc += s.hours) : (neo += s.hours);
  let nl = 0, ac = 0;
  for (const x of extras) if (x.done)
    x.category === "OPT" ? (opt += x.hours) : x.category === "NL" ? (nl += x.hours)
      : x.category === "AC" ? (ac += x.hours) : void 0;
  return { nc, neo, opt, nl, ac, tot: nc + neo + opt + nl + ac };
}
export const cappedPct = (v: number, req: number) => Math.min(100, (100 * v) / req);
