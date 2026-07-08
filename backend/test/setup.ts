// Setup global do Vitest: carrega variáveis de .env antes dos imports que leem process.env.
// Inócuo para os testes unitários (que não tocam env); necessário para os de integração.
import "dotenv/config";

// Se houver um banco de testes dedicado, usa-o (evita poluir o banco de desenvolvimento).
// Defina TEST_DATABASE_URL no .env apontando para um Postgres/DB separado e migrado.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
