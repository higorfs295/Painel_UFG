// RF-21 — visão administrativa: estatísticas da instância (somente ADMIN).
// Complementa /users (gestão de contas) com números agregados para o painel do admin.
import type { FastifyInstance } from "fastify";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/stats", { preHandler: app.requireAdmin }, async () => {
    const [users, admins, pendingInvites, courses, enrollments, statuses, extras, scenarios] =
      await Promise.all([
        app.prisma.user.count(),
        app.prisma.user.count({ where: { role: "ADMIN" } }),
        app.prisma.user.count({ where: { passwordHash: null } }),
        app.prisma.course.count(),
        app.prisma.enrollment.count(),
        app.prisma.subjectStatus.count(),
        app.prisma.extraComponent.count(),
        app.prisma.scenario.count(),
      ]);
    return {
      users: { total: users, admins, pendingInvites },
      courses,
      enrollments,
      activity: { subjectStatuses: statuses, extras, scenarios },
    };
  });
}
