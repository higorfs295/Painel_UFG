-- Novas categorias de extra (permitem reclassificar NL em NC/NE/NE-optativa)
ALTER TYPE "ExtraCategory" ADD VALUE IF NOT EXISTS 'NC' BEFORE 'OPT';
ALTER TYPE "ExtraCategory" ADD VALUE IF NOT EXISTS 'NE' BEFORE 'OPT';

-- Estado do extra: planejado | em andamento | concluído (substitui o booleano `done`)
CREATE TYPE "ExtraStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');

-- Adiciona `status`, migra a partir de `done` (preserva o que era planejado) e remove `done`
ALTER TABLE "ExtraComponent" ADD COLUMN "status" "ExtraStatus" NOT NULL DEFAULT 'DONE';
UPDATE "ExtraComponent" SET "status" = 'PLANNED' WHERE "done" = false;
ALTER TABLE "ExtraComponent" DROP COLUMN "done";
