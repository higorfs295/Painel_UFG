// Somas por composição com teto de exibição em 100% (RF-05 / RN-04).
//
// Distinção importante entre dois números:
//  - valor REAL de cada composição (preservado, pode exceder o mínimo — ex.: 286h de NL);
//  - contribuição para a INTEGRALIZAÇÃO (limitada ao mínimo de cada composição), pois horas
//    além do mínimo de uma composição não "adiantam" a formatura em outra.
//
// Por isso o total integralizado é a soma das contribuições LIMITADAS, nunca ultrapassando o
// total exigido pelo curso. O excedente fica registrado por composição (campo `excess`) para a
// UI exibir "+X h além do mínimo", mas não infla o total.
//
// Nota de import: com moduleResolution node16/nodenext, caminhos relativos exigem a extensão
// ".js" explícita (mesmo apontando para um arquivo .ts) — é o padrão NodeNext.
import type { Subject } from "./graph.js";
export type Extra = { hours: number; category: "OPT" | "NL" | "AC" | "NONE"; done: boolean };
export type Requirement = { key: string; label: string; hours: number };

// mínimos por composição do curso (parametrizável; no backend virão de CompositionRequirement)
export type Minimums = { nc: number; neo: number; opt: number; nl: number; ac: number };

export type CompositionSum = {
  raw: number;        // horas reais cursadas na composição
  min: number;        // mínimo exigido
  counted: number;    // quanto conta para a integralização (= min(raw, min))
  excess: number;     // horas além do mínimo (= max(0, raw - min))
};

export function sums(
  subjects: Subject[],
  approved: Set<number>,
  extras: Extra[],
  minimums: Minimums,
) {
  let nc = 0, neo = 0, opt = 0;
  for (const s of subjects) if (approved.has(s.seq))
    s.groupOpt > 0 ? (opt += s.hours) : s.nucleus === "NC" ? (nc += s.hours) : (neo += s.hours);
  let nl = 0, ac = 0;
  for (const x of extras) if (x.done)
    x.category === "OPT" ? (opt += x.hours) : x.category === "NL" ? (nl += x.hours)
      : x.category === "AC" ? (ac += x.hours) : void 0;

  const raw = { nc, neo, opt, nl, ac };
  const comp = {} as Record<keyof Minimums, CompositionSum>;
  let counted = 0;
  (Object.keys(minimums) as (keyof Minimums)[]).forEach((k) => {
    const min = minimums[k];
    const c = Math.min(raw[k], min);         // contribuição limitada ao mínimo
    comp[k] = { raw: raw[k], min, counted: c, excess: Math.max(0, raw[k] - min) };
    counted += c;
  });

  const totalRequired = minimums.nc + minimums.neo + minimums.opt + minimums.nl + minimums.ac;
  const totalReal = nc + neo + opt + nl + ac;
  return {
    ...raw,                       // compatibilidade: nc, neo, opt, nl, ac (valores reais)
    comp,                         // detalhe por composição (raw/min/counted/excess)
    totalReal,                    // soma bruta (informativo)
    tot: counted,                 // total integralizado (NUNCA passa do exigido)
    totalRequired,
    totalExcess: totalReal - counted, // excedente global agregado
  };
}

export const cappedPct = (v: number, req: number) => Math.min(100, (100 * v) / req);