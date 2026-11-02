// v12 — números para a administração, em duas famílias bem separadas:
//
// 1. `overview`: OPERACIONAIS (contas, acessos, cursos, avisos). São dados de conta que o admin
//    já gere hoje (lista de usuários, trilha de auditoria) — nada acadêmico.
//
// 2. `courseReport`: ACADÊMICOS, mas só AGREGADOS por curso. Decisão do dono do projeto: o admin
//    não vê dado individual de aluno (nem progresso, nem notas). Por isso o relatório
//      · só devolve contagens, médias e distribuições — nunca uma linha por aluno;
//      · some inteiro quando o curso tem menos de MIN_GROUP alunos: com 1 a 4 alunos, uma
//        "média" ou um histograma praticamente revela o dado de alguém. Cinco é uma regra
//        prática comum de supressão de células pequenas — não é um número tirado de lei;
//      · não usa notas, faltas, anotações, agenda nem cenários.
import type { PrismaClient } from "@prisma/client";
import { loadCourseGraph } from "../../domain/loadCourse.js";
import { computeProgress, type StatusRecord } from "../../domain/progress.js";
import { buildDeps, unlockCount, type Subject } from "../../domain/graph.js";
import type { Extra } from "../../domain/sums.js";

export const MIN_GROUP = 5;
const DAY = 86_400_000;
const WEEKS = 12;
const HEATMAP_DAYS = 182; // 26 semanas (um semestre): o mapa de calor de acessos

/** "AAAA-MM-DD" em UTC — o banco guarda TIMESTAMP sem fuso, em UTC. */
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Segunda-feira 00:00 UTC da semana de `d` (o mesmo corte do date_trunc('week') do Postgres). */
function weekStart(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // 0 = segunda
  return new Date(x.getTime() - dow * DAY);
}

type Bucket = { t: Date; n: bigint };

/** Preenche a série com zeros onde o banco não devolveu linha. */
function fill(rows: Bucket[], starts: Date[]) {
  const byKey = new Map(rows.map((r) => [isoDay(new Date(r.t)), Number(r.n)]));
  return starts.map((s) => ({ date: isoDay(s), count: byKey.get(isoDay(s)) ?? 0 }));
}

export async function overview(prisma: PrismaClient) {
  const now = new Date();
  const since = (days: number) => new Date(now.getTime() - days * DAY);
  const firstWeek = new Date(weekStart(now).getTime() - (WEEKS - 1) * 7 * DAY);
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (HEATMAP_DAYS - 1) * DAY);

  const [
    total, admins, pending, new7, new30, withoutCourse, active7, active30,
    signupRows, loginRows, courses, live, scheduled, statuses, extras, scenarios, tasks, recent,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { passwordHash: null } }),
    prisma.user.count({ where: { createdAt: { gte: since(7) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(30) } } }),
    prisma.user.count({ where: { role: "USER", enrollments: { none: {} } } }),
    // "ativo" = abriu ou renovou sessão na janela. Cada login e cada renovação emite um refresh
    // token novo (rotação), então o createdAt deles é o melhor sinal de uso que o sistema tem.
    prisma.refreshToken.findMany({ where: { createdAt: { gte: since(7) } }, distinct: ["userId"], select: { userId: true } }),
    prisma.refreshToken.findMany({ where: { createdAt: { gte: since(30) } }, distinct: ["userId"], select: { userId: true } }),
    prisma.$queryRaw<Bucket[]>`
      SELECT date_trunc('week', "createdAt") AS t, COUNT(*)::bigint AS n
      FROM "User" WHERE "createdAt" >= ${firstWeek} GROUP BY 1`,
    prisma.$queryRaw<Bucket[]>`
      SELECT date_trunc('day', "createdAt") AS t, COUNT(*)::bigint AS n
      FROM "AuditLog" WHERE "action" = 'auth.login' AND "createdAt" >= ${firstDay} GROUP BY 1`,
    prisma.course.findMany({
      where: { deletedAt: null }, orderBy: { name: "asc" },
      select: {
        slug: true, name: true, totalHours: true,
        _count: { select: { subjects: true, enrollments: true } },
      },
    }),
    prisma.announcement.count({
      where: { publishAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    }),
    prisma.announcement.count({ where: { publishAt: { gt: now } } }),
    prisma.subjectStatus.count(),
    prisma.extraComponent.count(),
    prisma.scenario.count(),
    prisma.studyTask.count(),
    // feed de GESTÃO: os logins já aparecem no mapa de calor e afogariam o resto
    prisma.auditLog.findMany({
      where: { NOT: { action: { startsWith: "auth." } } },
      orderBy: { createdAt: "desc" }, take: 12,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const weeks = Array.from({ length: WEEKS }, (_, i) => new Date(firstWeek.getTime() + i * 7 * DAY));
  const days = Array.from({ length: HEATMAP_DAYS }, (_, i) => new Date(firstDay.getTime() + i * DAY));

  return {
    generatedAt: now.toISOString(),
    users: {
      total, admins, students: total - admins, pendingInvites: pending,
      new7d: new7, new30d: new30, withoutCourse,
      active7d: active7.length, active30d: active30.length,
    },
    signupsByWeek: fill(signupRows, weeks),
    loginsByDay: fill(loginRows, days),
    courses: courses.map((c) => ({
      slug: c.slug, name: c.name, totalHours: c.totalHours,
      subjects: c._count.subjects, enrollments: c._count.enrollments,
    })),
    announcements: { live, scheduled },
    activity: { subjectStatuses: statuses, extras, scenarios, tasks },
    recent,
  };
}

type SubjectAgg = {
  seq: number; code: string; name: string; hours: number; nucleus: "NC" | "NE"; groupOpt: number;
  approved: number; enrolled: number; apt: number; pending: number; unlocks: number;
};

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const round1 = (x: number) => Math.round(x * 10) / 10;

export async function courseReport(prisma: PrismaClient, slug: string) {
  const course = await prisma.course.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, slug: true, name: true, totalHours: true },
  });
  if (!course) return null;

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: course.id }, select: { id: true, startTerm: true },
  });
  const base = {
    course: { slug: course.slug, name: course.name, totalHours: course.totalHours },
    students: enrollments.length,
    minGroup: MIN_GROUP,
  };
  if (enrollments.length < MIN_GROUP) return { ...base, suppressed: true as const };

  const graph = await loadCourseGraph(prisma, course.id);
  if (!graph) return null;
  const ids = enrollments.map((e) => e.id);
  const [statusRows, extraRows] = await Promise.all([
    prisma.subjectStatus.findMany({
      where: { enrollmentId: { in: ids } },
      select: { enrollmentId: true, state: true, subject: { select: { seq: true } } },
    }),
    prisma.extraComponent.findMany({
      where: { enrollmentId: { in: ids } },
      select: { enrollmentId: true, hours: true, category: true, status: true },
    }),
  ]);

  const statusesBy = new Map<string, StatusRecord[]>();
  for (const r of statusRows) {
    const list = statusesBy.get(r.enrollmentId) ?? [];
    list.push({ seq: r.subject.seq, state: r.state });
    statusesBy.set(r.enrollmentId, list);
  }
  const extrasBy = new Map<string, Extra[]>();
  for (const r of extraRows) {
    const list = extrasBy.get(r.enrollmentId) ?? [];
    list.push({ hours: r.hours, category: r.category, status: r.status });
    extrasBy.set(r.enrollmentId, list);
  }

  // peso de "gargalo": quantas disciplinas dependem (transitivamente) de cada uma, na matriz crua
  const bySeq = new Map<number, Subject>(graph.subjects.map((s) => [s.seq, s]));
  const deps = buildDeps(graph.subjects);
  const none = new Set<number>();
  const subjects = new Map<number, SubjectAgg>(graph.subjects.map((s) => [s.seq, {
    seq: s.seq, code: s.code, name: s.name, hours: s.hours, nucleus: s.nucleus, groupOpt: s.groupOpt,
    approved: 0, enrolled: 0, apt: 0, pending: 0,
    unlocks: unlockCount(s.seq, deps, none, bySeq).tot,
  }]));

  const pcts: number[] = [];
  const comp = new Map<string, { label: string; required: number; sumPct: number; done: number }>();
  const reached = new Map<string, { hours: number; description: string; count: number }>();

  for (const e of enrollments) {
    const p = computeProgress({
      subjects: graph.subjects, milestones: graph.milestones, requirements: graph.requirements,
      statuses: statusesBy.get(e.id) ?? [], extras: extrasBy.get(e.id) ?? [], totalHours: graph.totalHours,
    });
    pcts.push(p.totals.pct);
    for (const c of p.compositions) {
      const a = comp.get(c.key) ?? { label: c.label, required: c.required, sumPct: 0, done: 0 };
      a.sumPct += c.pct; if (c.pct >= 100) a.done += 1;
      comp.set(c.key, a);
    }
    for (const m of p.milestones) {
      const a = reached.get(m.key) ?? { hours: m.hours, description: m.description, count: 0 };
      if (m.reached) a.count += 1;
      reached.set(m.key, a);
    }
    for (const s of p.subjects) {
      const agg = subjects.get(s.seq);
      if (!agg) continue;
      if (s.state === "APPROVED") agg.approved += 1;
      else if (s.state === "ENROLLED") agg.enrolled += 1;
      else {
        // pendente (simulada também: é só planejamento)
        agg.pending += 1;
        if (s.status === "avail" || s.status === "co") agg.apt += 1;
      }
    }
  }

  const n = enrollments.length;
  const histogram = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, count: 0 }));
  for (const pct of pcts) histogram[Math.min(9, Math.floor(pct / 10))]!.count += 1;

  const cohorts = new Map<string, number>();
  for (const e of enrollments) {
    const k = e.startTerm ?? "não informado";
    cohorts.set(k, (cohorts.get(k) ?? 0) + 1);
  }

  return {
    ...base,
    suppressed: false as const,
    progress: {
      avgPct: round1(pcts.reduce((a, b) => a + b, 0) / n),
      medianPct: round1(median(pcts)),
      histogram,
    },
    compositions: [...comp.entries()].map(([key, a]) => ({
      key, label: a.label, required: a.required,
      avgPct: round1(a.sumPct / n), completedPct: round1((a.done / n) * 100),
    })),
    milestones: [...reached.entries()].map(([key, a]) => ({
      key, hours: a.hours, description: a.description, reachedPct: round1((a.count / n) * 100),
    })),
    cohorts: [...cohorts.entries()]
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => a.term.localeCompare(b.term)),
    subjects: [...subjects.values()],
  };
}
