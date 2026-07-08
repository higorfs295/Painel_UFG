-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Nucleus" AS ENUM ('NC', 'NE');

-- CreateEnum
CREATE TYPE "ReqType" AS ENUM ('PRE', 'CO');

-- CreateEnum
CREATE TYPE "SubjectState" AS ENUM ('APPROVED', 'SIMULATED');

-- CreateEnum
CREATE TYPE "ExtraCategory" AS ENUM ('OPT', 'NL', 'AC', 'NONE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'SET_PASSWORD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalHours" INTEGER NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionRequirement" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,

    CONSTRAINT "CompositionRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "nucleus" "Nucleus" NOT NULL,
    "groupOpt" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisite" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "requiresSubjectId" TEXT,
    "milestoneKey" TEXT,
    "type" "ReqType" NOT NULL,

    CONSTRAINT "Requisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "startTerm" TEXT,
    "currentTerm" TEXT,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectStatus" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "state" "SubjectState" NOT NULL,
    "term" TEXT,

    CONSTRAINT "SubjectStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraComponent" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "category" "ExtraCategory" NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioDiscipline" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "docente" TEXT,
    "sigaaCode" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL,

    CONSTRAINT "ScenarioDiscipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioPaint" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "cellKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "ScenarioPaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_tokenHash_key" ON "InviteToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionRequirement_courseId_key_key" ON "CompositionRequirement"("courseId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_courseId_key_key" ON "Milestone"("courseId", "key");

-- CreateIndex
CREATE INDEX "Subject_courseId_groupOpt_idx" ON "Subject"("courseId", "groupOpt");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_courseId_seq_key" ON "Subject"("courseId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectStatus_enrollmentId_subjectId_key" ON "SubjectStatus"("enrollmentId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioPaint_scenarioId_cellKey_key" ON "ScenarioPaint"("scenarioId", "cellKey");

-- AddForeignKey
ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionRequirement" ADD CONSTRAINT "CompositionRequirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisite" ADD CONSTRAINT "Requisite_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisite" ADD CONSTRAINT "Requisite_requiresSubjectId_fkey" FOREIGN KEY ("requiresSubjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectStatus" ADD CONSTRAINT "SubjectStatus_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectStatus" ADD CONSTRAINT "SubjectStatus_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraComponent" ADD CONSTRAINT "ExtraComponent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioDiscipline" ADD CONSTRAINT "ScenarioDiscipline_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioPaint" ADD CONSTRAINT "ScenarioPaint_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
