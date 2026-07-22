-- Lixeira de cursos (RF-28): exclusão em duas etapas.
-- deletedAt != null = na lixeira; o expurgo definitivo acontece após 7 dias (job no server.ts).
ALTER TABLE "Course" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Course_deletedAt_idx" ON "Course"("deletedAt");
