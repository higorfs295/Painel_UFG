// Setup global do Vitest: carrega variáveis de .env antes dos imports que leem process.env.
// Inócuo para os testes unitários (que não tocam env); necessário para os de integração.
import "dotenv/config";
