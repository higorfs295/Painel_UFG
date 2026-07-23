// O `tsc` compila .ts e ignora tudo o mais. Os JSONs do seed (matriz, perfis, alunos) são
// lidos em tempo de execução por caminho relativo ao módulo — então precisam existir ao lado
// do .js compilado, senão `node dist/seed/seed.js` morre com ENOENT.
//
// Foi exatamente o que acontecia ao semear a stack Docker: a imagem só tem `dist/`, e o
// arquivo da matriz não estava lá.
import { cp, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const de = join(raiz, "src", "seed");
const para = join(raiz, "dist", "seed");

await mkdir(para, { recursive: true });

const arquivos = (await readdir(de)).filter((f) => f.endsWith(".json"));
for (const f of arquivos) await cp(join(de, f), join(para, f));

console.log(`assets do seed copiados para dist/seed (${arquivos.length}): ${arquivos.join(", ")}`);
