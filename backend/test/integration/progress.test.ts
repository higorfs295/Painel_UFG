import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, createUser, login, uniqueSlug, authHeader } from "./helpers.js";
import { importCourse } from "../../src/domain/importCourse.js";

let app: FastifyInstance;
let courseId: string;
let subjBySeq: Map<number, string>;

// mini-matriz: 1 NC(200h), 2 NEO(100h, pré=1), 3 optativa(100h)
const matriz = (slug: string) => ({
  course: { slug, name: "Curso de Teste" },
  totalHours: 400,
  requirements: [
    { key: "NC", label: "Núcleo Comum", hours: 100 },
    { key: "NEO", label: "Obrigatório", hours: 100 },
    { key: "OPT", label: "Optativo", hours: 100 },
    { key: "NL", label: "Livre", hours: 100 },
    { key: "AC", label: "Atividades", hours: 100 },
  ],
  milestones: [{ key: "CH1", hours: 150, description: "marco" }],
  subjects: [
    { seq: 1, code: "A1", name: "Um", hours: 200, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
    { seq: 2, code: "A2", name: "Dois", hours: 100, nucleus: "NE", groupOpt: 0, pre: [1], co: [] },
    { seq: 3, code: "A3", name: "Três", hours: 100, nucleus: "NE", groupOpt: 2, pre: [], co: [] },
  ],
});

beforeAll(async () => {
  app = await makeApp();
  const slug = uniqueSlug();
  await importCourse(app.prisma, matriz(slug));
  const course = await app.prisma.course.findUniqueOrThrow({ where: { slug } });
  courseId = course.id;
  const subs = await app.prisma.subject.findMany({ where: { courseId }, select: { id: true, seq: true } });
  subjBySeq = new Map(subs.map(s => [s.seq, s.id]));
});
afterAll(async () => { await app.close(); });

async function newEnrolledUser() {
  const user = await createUser(app, { password: "senha-forte-123" });
  const enr = await app.prisma.enrollment.create({ data: { userId: user.id, courseId } });
  const { accessToken } = await login(app, user.email, "senha-forte-123");
  return { user, enr, accessToken };
}

describe("progresso e posse (RF-05/06, RNF-05)", () => {
  it("marcar disciplina reflete nas somas e no status", async () => {
    const { enr, accessToken } = await newEnrolledUser();

    const put = await app.inject({
      method: "PUT", url: `/me/enrollments/${enr.id}/subjects/${subjBySeq.get(1)}`,
      headers: authHeader(accessToken), payload: { state: "APPROVED" },
    });
    expect(put.statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: `/me/enrollments/${enr.id}/progress`, headers: authHeader(accessToken) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totals.hours).toBe(200);
    const nc = body.compositions.find((c: any) => c.key === "NC");
    expect(nc.pct).toBe(100);      // 200/100 travado
    expect(nc.over).toBe(100);     // excedente registrado
    expect(body.milestones.find((m: any) => m.key === "CH1").reached).toBe(true);
    expect(body.subjects.find((s: any) => s.seq === 2).status).toBe("avail"); // pré aprovada
  });

  it("voltar disciplina a pendente (state=null) remove o status", async () => {
    const { enr, accessToken } = await newEnrolledUser();
    const url = `/me/enrollments/${enr.id}/subjects/${subjBySeq.get(1)}`;
    await app.inject({ method: "PUT", url, headers: authHeader(accessToken), payload: { state: "APPROVED" } });
    const del = await app.inject({ method: "PUT", url, headers: authHeader(accessToken), payload: { state: null } });
    expect(del.statusCode).toBe(204);
    const res = await app.inject({ method: "GET", url: `/me/enrollments/${enr.id}/progress`, headers: authHeader(accessToken) });
    expect(res.json().totals.hours).toBe(0);
  });

  it("recomenda disponíveis por destravamento (RF-07)", async () => {
    const { enr, accessToken } = await newEnrolledUser();
    await app.inject({
      method: "PUT", url: `/me/enrollments/${enr.id}/subjects/${subjBySeq.get(1)}`,
      headers: authHeader(accessToken), payload: { state: "APPROVED" },
    });
    const res = await app.inject({ method: "GET", url: `/me/enrollments/${enr.id}/recommendations`, headers: authHeader(accessToken) });
    expect(res.statusCode).toBe(200);
    const seqs = (res.json() as any[]).map(r => r.seq);
    expect(seqs).toContain(2); // destravada pela 1
    expect(seqs).not.toContain(1);
  });

  it("nega acesso ao enrollment de outro usuário (403)", async () => {
    const owner = await newEnrolledUser();
    const intruder = await newEnrolledUser();
    const res = await app.inject({
      method: "GET", url: `/me/enrollments/${owner.enr.id}/progress`,
      headers: authHeader(intruder.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });
});
