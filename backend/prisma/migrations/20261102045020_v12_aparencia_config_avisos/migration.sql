-- v12: cor de destaque e estilo da barra lateral por usuário; configurações da instância
-- editáveis em runtime; avisos com curso-alvo, agendamento e validade.

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- avisos que já existiam foram "publicados" quando criados, não na hora da migração
UPDATE "Announcement" SET "publishAt" = "createdAt";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accent" TEXT NOT NULL DEFAULT 'orange',
ADD COLUMN     "sidebar" TEXT NOT NULL DEFAULT 'light';

-- CreateTable
CREATE TABLE "InstanceSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "InstanceSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Announcement_publishAt_idx" ON "Announcement"("publishAt");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
