// RF-22/23 — histórico por período, MGA ponderada por CH e ritmo de formatura.
import { describe, it, expect } from "vitest";
import { termsSummary, mga, pace, type HistoryItem } from "../../src/domain/history.js";
import { achievements } from "../../src/domain/achievements.js";

const H = (over: Partial<HistoryItem> & { seq: number }): HistoryItem => ({
  state: "APPROVED", term: "2024.1", grade: null, hours: 64, ...over,
});

describe("termsSummary / mga (ponderação por CH)", () => {
  const items: HistoryItem[] = [
    H({ seq: 1, term: "2024.1", grade: 10, hours: 100 }),
    H({ seq: 2, term: "2024.1", grade: 5, hours: 50 }),   // média 2024.1 = (10*100+5*50)/150 = 8.33
    H({ seq: 3, term: "2024.2", grade: 7, hours: 64 }),
    H({ seq: 4, term: "2024.2", grade: null, hours: 32 }), // sem nota: soma CH, fora da média
    H({ seq: 5, term: null, hours: 30 }),                  // sem período: balde à parte
    H({ seq: 6, state: "ENROLLED", term: "2025.1", hours: 64 }), // cursando: fora do histórico
  ];

  it("agrupa por período em ordem, com CH e média ponderada", () => {
    const { terms, noTerm } = termsSummary(items);
    expect(terms.map((t) => t.term)).toEqual(["2024.1", "2024.2"]);
    expect(terms[0]).toMatchObject({ hours: 150, count: 2, avg: 8.33 });
    expect(terms[1]).toMatchObject({ hours: 96, count: 2, avg: 7 }); // só a com nota entra na média
    expect(noTerm).toEqual({ hours: 30, count: 1 });
  });

  it("MGA pondera por CH todas as aprovadas com nota", () => {
    // (10*100 + 5*50 + 7*64) / 214 = 7.93
    expect(mga(items)).toBe(7.93);
  });

  it("sem nenhuma nota lançada, médias são null", () => {
    const semNota = [H({ seq: 1, grade: null }), H({ seq: 2, grade: null })];
    expect(mga(semNota)).toBeNull();
    expect(termsSummary(semNota).terms[0]!.avg).toBeNull();
  });
});

describe("pace (ritmo/estimativa de formatura)", () => {
  const terms = [
    { term: "2023.1", hours: 300, count: 5, avg: null },
    { term: "2023.2", hours: 400, count: 6, avg: null },
    { term: "2024.1", hours: 350, count: 5, avg: null },
  ];
  it("usa a média dos últimos períodos p/ estimar quantos faltam", () => {
    const p = pace(terms, 1400); // média 350/período -> 4 períodos
    expect(p.avgHoursPerTerm).toBe(350);
    expect(p.estTermsLeft).toBe(4);
  });
  it("integralizado -> 0; sem histórico -> null", () => {
    expect(pace(terms, 0).estTermsLeft).toBe(0);
    expect(pace([], 1000).estTermsLeft).toBeNull();
  });
});

describe("achievements (conquistas derivadas)", () => {
  it("concede pelos limiares e nunca persiste estado", () => {
    const list = achievements({
      pct: 52, doneCount: 26, enrolledCount: 2, milestonesReached: 1, milestonesTotal: 3,
      extrasDone: 3, mga: 8.2, termsCount: 4, scenarios: 1,
    });
    const earned = new Set(list.filter((a) => a.earned).map((a) => a.key));
    for (const k of ["primeira-luz", "trilheiro", "caminho-aberto", "raiz-profunda", "meio-do-cerrado",
      "marco-zero", "colecionador", "notavel", "constante", "arquiteto", "em-movimento"])
      expect(earned, k).toContain(k);
    expect(earned).not.toContain("reta-final");
    expect(earned).not.toContain("todos-os-marcos");
  });
  it("média ausente não concede 'notavel'; marcos zerados não concedem 'todos-os-marcos'", () => {
    const list = achievements({
      pct: 0, doneCount: 0, enrolledCount: 0, milestonesReached: 0, milestonesTotal: 0,
      extrasDone: 0, mga: null, termsCount: 0, scenarios: 0,
    });
    expect(list.every((a) => !a.earned)).toBe(true);
  });
});
