-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('TERM', 'BREAK');

-- CreateTable
CREATE TABLE "AcademicPeriod" (
    "id" TEXT NOT NULL,
    "type" "PeriodType" NOT NULL,
    "term" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicPeriod_startsAt_key" ON "AcademicPeriod"("startsAt");

-- CreateIndex
CREATE INDEX "AcademicPeriod_startsAt_idx" ON "AcademicPeriod"("startsAt");
