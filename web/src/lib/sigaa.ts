// Parser de códigos de horário SIGAA (portado do protótipo, testado).
// "56M23456" => qui/sex, matutino, aulas 2..6. Vários blocos separados por espaço.
export type SlotKey = string; // "dia-turnoNum", ex.: "2-M1"

export function parseSIGAA(str: string): { slots: SlotKey[]; errs: string[] } {
  const out: string[] = [], errs: string[] = [];
  const toks = (str || "").trim().toUpperCase().split(/\s+/).filter(Boolean);
  for (const t of toks) {
    const m = t.match(/^([2-7]+)([MTN])([1-6]+)$/);
    if (!m) { errs.push(t); continue; }
    for (const d of m[1]!) for (const h of m[3]!) { // grupos garantidos pelo próprio match
      if (m[2] === "N" && +h > 5) { errs.push(`${t} (noturno vai até N5)`); continue; }
      out.push(`${d}-${m[2]}${h}`);
    }
  }
  return { slots: [...new Set(out)], errs };
}

export const SLOTS = [
  { id: "M1", lab: "07:10–08:00" }, { id: "M2", lab: "08:01–08:50" }, { id: "M3", lab: "08:51–09:40" },
  { id: "M4", lab: "10:00–10:50" }, { id: "M5", lab: "10:51–11:40" }, { id: "M6", lab: "11:41–12:30" },
  { id: "T1", lab: "13:10–14:00" }, { id: "T2", lab: "14:01–14:50" }, { id: "T3", lab: "14:51–15:40" },
  { id: "T4", lab: "16:00–16:50" }, { id: "T5", lab: "16:51–17:40" }, { id: "T6", lab: "17:41–18:30" },
  { id: "N1", lab: "18:05–18:50" }, { id: "N2", lab: "18:51–19:35" }, { id: "N3", lab: "19:36–20:20" },
  { id: "N4", lab: "20:30–21:15" }, { id: "N5", lab: "21:16–22:00" },
] as const;
