import { describe, it, expect } from "vitest";
import { parseSIGAA, conflicts } from "../../src/domain/sigaa.js";

describe("parseSIGAA", () => {
  it("expande dias × aulas de um bloco", () => {
    const { slots, errs } = parseSIGAA("56M23456");
    expect(errs).toEqual([]);
    // dias 5 e 6, matutino, aulas 2..6 => 2 dias × 5 aulas
    expect(slots).toHaveLength(10);
    expect(slots).toContain("5-M2");
    expect(slots).toContain("6-M6");
  });

  it("junta múltiplos blocos e deduplica", () => {
    const { slots } = parseSIGAA("2M12 2M12 4T34");
    expect(slots.sort()).toEqual(["2-M1", "2-M2", "4-T3", "4-T4"]);
  });

  it("rejeita tokens malformados", () => {
    const { errs } = parseSIGAA("XYZ 9M1 2M7");
    expect(errs).toContain("XYZ");
    expect(errs).toContain("9M1"); // dia inválido (só 2..7)
    expect(errs).toContain("2M7"); // aula inválida (1..6)
  });

  it("valida limite do turno noturno (N vai até N5)", () => {
    const { slots, errs } = parseSIGAA("2N6");
    expect(slots).toEqual([]);
    expect(errs.some(e => e.includes("noturno"))).toBe(true);
  });
});

describe("conflicts", () => {
  it("detecta interseção de horários", () => {
    expect(conflicts("2M12", "2M23")).toEqual(["2-M2"]);
  });
  it("sem interseção retorna vazio", () => {
    expect(conflicts("2M12", "3M12")).toEqual([]);
  });
});
