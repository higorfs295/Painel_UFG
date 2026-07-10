// Importa para o banco todas as matrizes de ../matrizes/*.json (ignora _MODELO*).
// Idempotente: reexecutar atualiza os cursos existentes (upsert por slug/seq).
//
//   npm run matrizes            # usa o DATABASE_URL do .env
//   DATABASE_URL=... npx tsx scripts/importar-matrizes.ts [dir-ou-arquivo.json ...]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { importCourse } from "../src/domain/importCourse.js";

const here = dirname(fileURLToPath(import.meta.url));
const padrao = join(here, "..", "..", "matrizes");
const alvos = process.argv.slice(2).length ? process.argv.slice(2) : [padrao];

const arquivos: string[] = [];
for (const alvo of alvos) {
  if (statSync(alvo).isDirectory()) {
    for (const f of readdirSync(alvo))
      if (f.endsWith(".json") && !basename(f).startsWith("_")) arquivos.push(join(alvo, f));
  } else {
    arquivos.push(alvo);
  }
}
if (!arquivos.length) { console.error("nenhuma matriz encontrada"); process.exit(2); }

const prisma = new PrismaClient();
try {
  for (const arq of arquivos.sort()) {
    const raw = JSON.parse(readFileSync(arq, "utf-8"));
    const r = await importCourse(prisma, raw);
    console.log(`✔ ${r.slug}: ${r.subjects} disciplinas importadas/atualizadas (${basename(arq)})`);
  }
} finally {
  await prisma.$disconnect();
}
