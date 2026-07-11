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
export type ExtraCategoryKind = "NC" | "NE" | "OPT" | "NL" | "AC" | "NONE";
export type ExtraStatusKind = "PLANNED" | "IN_PROGRESS" | "DONE";
// `extras` recebido por `sums` já vem FILTRADO pelo chamador (o que conta no oficial vs projeção);
// aqui todo extra da lista é contado, roteado pela categoria. NONE nunca soma.
export type Extra = { hours: number; category: ExtraCategoryKind; status: ExtraStatusKind };
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
  let nc = 0, neo = 0, opt = 0, nl = 0, ac = 0;
  for (const s of subjects) if (approved.has(s.seq))
    s.groupOpt > 0 ? (opt += s.hours) : s.nucleus === "NC" ? (nc += s.hours) : (neo += s.hours);
  // extras já vêm filtrados; um extra reclassificado soma na composição da sua categoria
  for (const x of extras) switch (x.category) {
    case "NC": nc += x.hours; break;
    case "NE": neo += x.hours; break;   // NE obrigatório
    case "OPT": opt += x.hours; break;  // NE optativa
    case "NL": nl += x.hours; break;
    case "AC": ac += x.hours; break;
    // NONE: registro, não soma
  }

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