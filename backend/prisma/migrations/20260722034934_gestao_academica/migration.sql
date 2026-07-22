-- Gestão acadêmica ampliada (RF-22..27): notas/faltas, avisos, agenda, anotações e auditoria.

-- RF-22: nota final e faltas por disciplina cursada
ALTER TABLE "SubjectStatus" ADD COLUMN "grade" DOUBLE PRECISION;
ALTER TABLE "SubjectStatus" ADD COLUMN "absences" INTEGER;

-- RF-24: avisos/comunicados
CREATE TYPE "Audience" AS ENUM ('ALL', 'STUDENTS', 'ADMINS');
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "Audience" NOT NULL DEFAULT 'ALL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RF-25: agenda pessoal (provas, trabalhos, entregas)
CREATE TYPE "TaskKind" AS ENUM ('PROVA', 'TRABALHO', 'ENTREGA', 'OUTRO');
CREATE TABLE "StudyTask" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "TaskKind" NOT NULL DEFAULT 'OUTRO',
    "dueAt" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "subjectCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudyTask_enrollmentId_dueAt_idx" ON "StudyTask"("enrollmentId", "dueAt");
ALTER TABLE "StudyTask" ADD CONSTRAINT "StudyTask_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RF-26: anotação pessoal por disciplina
CREATE TABLE "SubjectNote" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubjectNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubjectNote_enrollmentId_subjectId_key" ON "SubjectNote"("enrollmentId", "subjectId");
ALTER TABLE "SubjectNote" ADD CONSTRAINT "SubjectNote_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectNote" ADD CONSTRAINT "SubjectNote_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RF-27: trilha de auditoria
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
