// Guarda de regressão das matrizes versionadas em /matrizes: qualquer edição que quebre o
// schema, deixe referência órfã ou desbalanceie as somas falha aqui (e no CI) antes de chegar
// a uma instância real. Também prova que os arquivos importam de ponta a ponta.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { makeApp } from "./helpers.js";
import { importCourse, matrizSchema } from "../../src/domain/importCourse.js";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "..", "..", "matrizes");
const arquivos = readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("_"));

let app: FastifyInstance;
beforeAll(async () => { app = await makeApp(); });
afterAll(async () => { await app.close(); });

describe("matrizes versionadas no repositório", () => {
  it("existe ao menos uma matriz publicada", () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(2);
  });

  it.each(arquivos)("%s: schema válido, íntegra e importável", async (arq) => {
    const raw = JSON.parse(readFileSync(join(dir, arq), "utf-8"));
    const m = matrizSchema.parse(raw); // schema do importador (lança se inválido)

    // integridade: toda referência de pré/co aponta para seq existente ou marco declarado
    const seqs = new Set(m.subjects.map(s => s.seq));
    const marcos = new Set(m.milestones.map(x => x.key));
    for (const s of m.subjects)
      for (const r of [...s.pre, ...s.co]) {
        if (typeof r === "number") expect(seqs.has(r), `seq ${s.seq}: ref ${r} órfã`).toBe(true);
        else expect(marcos.has(r), `seq ${s.seq}: marco ${r} órfão`).toBe(true);
      }

    // somas por núcleo batem com as composições declaradas
    const req = new Map(m.requirements.map(r => [r.key, r.hours]));
    const nc = m.subjects.filter(s => s.groupOpt === 0 && s.nucleus === "NC").reduce((t, s) => t + s.hours, 0);
    const neo = m.subjects.filter(s => s.groupOpt === 0 && s.nucleus === "NE").reduce((t, s) => t + s.hours, 0);
    expect(nc).toBe(req.get("NC"));
    expect(neo).toBe(req.get("NEO"));
    expect(m.requirements.reduce((t, r) => t + r.hours, 0)).toBe(m.totalHours);

    // importa de verdade (transacional, idempotente) e confere o resultado persistido
    const res = await importCourse(app.prisma, raw);
    expect(res.subjects).toBe(m.subjects.length);
    const course = await app.prisma.course.findUniqueOrThrow({
      where: { slug: m.course.slug },
      include: { _count: { select: { subjects: true, milestones: true, requirements: true } } },
    });
    expect(course._count.subjects).toBe(m.subjects.length);
    expect(course._count.milestones).toBe(m.milestones.length);
    expect(course._count.requirements).toBe(m.requirements.length);
  });

  it("elétrica 2023 contém as disciplinas recuperadas do PPC (97, 101, 153)", () => {
    const m = matrizSchema.parse(JSON.parse(readFileSync(join(dir, "matriz-engel-2023.json"), "utf-8")));
    const bySeq = new Map(m.subjects.map(s => [s.seq, s]));
    expect(bySeq.get(97)?.name).toMatch(/Regulação e Comercialização/);
    expect(bySeq.get(101)?.hours).toBe(32);
    expect(bySeq.get(153)?.pre).toEqual([]);
  });
});
