// RF-20 v2 — resolução do período letivo global a partir do calendário acadêmico.
import { describe, it, expect } from "vitest";
import { resolvePeriod, heuristic, type CalendarRow } from "../../src/domain/period.js";

const d = (iso: string) => new Date(iso);

// Exemplo do calendário real: 2026.1 -> férias em 06/07 -> 2026.2 em 10/08
const calendar: CalendarRow[] = [
  { type: "TERM", term: "2026.1", startsAt: d("2026-03-09T03:00:00Z") },
  { type: "BREAK", term: null, startsAt: d("2026-07-06T03:00:00Z") },
  { type: "TERM", term: "2026.2", startsAt: d("2026-08-10T03:00:00Z") },
];

describe("resolvePeriod (calendário global)", () => {
  it("dentro do período letivo: label do TERM vigente + próxima virada", () => {
    const p = resolvePeriod(calendar, d("2026-05-01T12:00:00Z"));
    expect(p).toMatchObject({ term: "2026.1", onBreak: false, label: "2026.1", source: "calendar" });
    expect(p.nextTerm).toBe("2026.2");
    expect(p.nextStartsAt).toBe("2026-07-06T03:00:00.000Z"); // a virada seguinte são as férias
  });

  it("nas férias: onBreak com o próximo TERM anunciado", () => {
    const p = resolvePeriod(calendar, d("2026-07-11T12:00:00Z"));
    expect(p).toMatchObject({ term: null, onBreak: true, label: "Férias", nextTerm: "2026.2" });
    expect(p.nextStartsAt).toBe("2026-08-10T03:00:00.000Z");
  });

  it("após a última virada: vale a última entrada, próximo TERM cai na heurística", () => {
    const p = resolvePeriod(calendar, d("2026-11-20T12:00:00Z"));
    expect(p).toMatchObject({ term: "2026.2", onBreak: false, source: "calendar" });
    expect(p.nextStartsAt).toBeUndefined();
  });

  it("sem calendário: heurística de meses (mar–jul .1, ago–dez .2, jan/fev férias)", () => {
    expect(resolvePeriod([], d("2026-05-01T12:00:00Z"))).toMatchObject({ term: "2026.1", source: "heuristic" });
    expect(resolvePeriod([], d("2026-09-01T12:00:00Z"))).toMatchObject({ term: "2026.2", nextTerm: "2027.1" });
    expect(resolvePeriod([], d("2026-01-15T12:00:00Z"))).toMatchObject({ onBreak: true, label: "Férias" });
    expect(heuristic(d("2026-08-02T12:00:00Z")).term).toBe("2026.2");
  });

  it("calendário só com entradas futuras: usa heurística até a primeira virada", () => {
    const p = resolvePeriod([calendar[2]!], d("2026-07-20T12:00:00Z"));
    expect(p.source).toBe("calendar"); // há calendário, mas nada vigente ainda
    expect(p.onBreak).toBe(false);     // heurística: julho = 2026.1
  });
});
