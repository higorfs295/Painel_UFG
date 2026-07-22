// Camada de serviço do progresso: orquestra banco + domínio puro.
//
// Motivação: os quatro endpoints (progress, history, achievements, recommendations) repetiam
// exatamente o mesmo preâmbulo — checar posse, carregar o grafo do curso, buscar status e
// extras — e cada um montava `StatusRecord[]` do seu jeito. Um único `loadEnrollmentContext`
// remove essa duplicação, garante que todos leiam a MESMA fatia de dados e concentra o custo
// em uma ida ao banco por request (as consultas correm em paralelo).
import type { PrismaClient } from "@prisma/client";
import { assertEnrollmentOwner } from "../../lib/ownership.js";
import { notFound } from "../../lib/errors.js";
import { loadCourseGraph, type CourseGraph } from "../../domain/loadCourse.js";
import { computeProgress, recommend, type StatusRecord, type ProgressResult } from "../../domain/progress.js";
import { termsSummary, mga, pace, type HistoryItem } from "../../domain/history.js";
import { achievements } from "../../domain/achievements.js";
import type { Extra } from "../../domain/sums.js";

/** Linha de status já com os campos da disciplina que o domínio precisa. */
type StatusRow = {
  state: "APPROVED" | "ENROLLED" | "SIMULATED";
  term: string | null;
  grade: number | null;
  absences: number | null;
  subject: { seq: number; hours: number; code: string; name: string };
};

export type EnrollmentContext = {
  enrollment: { id: string; courseId: string };
  graph: CourseGraph;
  statusRows: StatusRow[];
  extras: Extra[];
  /** Formas derivadas, calculadas uma vez e reaproveitadas pelos builders. */
  statuses: StatusRecord[];
  historyItems: HistoryItem[];
};

/**
 * Carrega tudo que os endpoints de progresso precisam, validando a posse.
 * Lança OwnershipError (403/404) ou AppError(404) quando o curso não existe.
 */
export async function loadEnrollmentContext(
  prisma: PrismaClient,
  enrollmentId: string,
  userId: string,
): Promise<EnrollmentContext> {
  const enrollment = await assertEnrollmentOwner(prisma, enrollmentId, userId);

  const [graph, statusRows, extras] = await Promise.all([
    loadCourseGraph(prisma, enrollment.courseId),
    prisma.subjectStatus.findMany({
      where: { enrollmentId },
      select: {
        state: true, term: true, grade: true, absences: true,
        subject: { select: { seq: true, hours: true, code: true, name: true } },
      },
    }),
    prisma.extraComponent.findMany({
      where: { enrollmentId },
      select: { hours: true, category: true, status: true },
    }),
  ]);
  if (!graph) throw notFound("curso do enrollment não encontrado");

  return {
    enrollment: { id: enrollment.id, courseId: enrollment.courseId },
    graph,
    statusRows,
    extras,
    statuses: statusRows.map((s) => ({ seq: s.subject.seq, state: s.state })),
    historyItems: statusRows.map((s) => ({
      seq: s.subject.seq, state: s.state, term: s.term, grade: s.grade, hours: s.subject.hours,
    })),
  };
}

/** RF-05: somas por composição, status por disciplina e marcos. */
export function buildProgress(ctx: EnrollmentContext): ProgressResult {
  const { graph, statuses, extras } = ctx;
  return computeProgress({
    subjects: graph.subjects, milestones: graph.milestones, requirements: graph.requirements,
    statuses, extras, totalHours: graph.totalHours,
  });
}

/** RF-22/23: histórico por período, MGA e ritmo de formatura. */
export function buildHistory(ctx: EnrollmentContext) {
  const summary = termsSummary(ctx.historyItems);
  const progress = buildProgress(ctx);
  const remaining = Math.max(0, progress.totals.required - progress.totals.hours);

  return {
    ...summary,
    mga: mga(ctx.historyItems),
    pace: pace(summary.terms, remaining),
    totals: { integralized: progress.totals.hours, required: progress.totals.required, remaining },
    // "histórico escolar": só o que foi/está sendo cursado, em ordem de período
    records: ctx.statusRows
      .filter((s) => s.state !== "SIMULATED")
      .map((s) => ({
        seq: s.subject.seq, code: s.subject.code, name: s.subject.name, hours: s.subject.hours,
        state: s.state, term: s.term, grade: s.grade, absences: s.absences,
      }))
      .sort((a, b) => (a.term ?? "9999.9").localeCompare(b.term ?? "9999.9") || a.seq - b.seq),
  };
}

/** RF-23: conquistas derivadas (nunca persistidas). `scenarios` vem de fora (contagem barata). */
export function buildAchievements(ctx: EnrollmentContext, scenarios: number) {
  const progress = buildProgress(ctx);
  const list = achievements({
    pct: progress.totals.pct,
    doneCount: ctx.statusRows.filter((s) => s.state === "APPROVED").length,
    enrolledCount: ctx.statusRows.filter((s) => s.state === "ENROLLED").length,
    milestonesReached: progress.milestones.filter((m) => m.reached).length,
    milestonesTotal: progress.milestones.length,
    extrasDone: ctx.extras.filter((x) => x.status === "DONE").length,
    mga: mga(ctx.historyItems),
    termsCount: termsSummary(ctx.historyItems).terms.length,
    scenarios,
  });
  return { achievements: list, earned: list.filter((a) => a.earned).length, total: list.length };
}

/** RF-07: ranking por destravamento transitivo. */
export function buildRecommendations(ctx: EnrollmentContext, limit?: number) {
  const { graph, statuses } = ctx;
  return recommend({
    subjects: graph.subjects, milestones: graph.milestones, requirements: graph.requirements, statuses,
    ...(limit !== undefined ? { limit } : {}),
  });
}
