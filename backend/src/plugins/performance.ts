// Desempenho e resiliência de borda. Três camadas independentes:
//
//  1. compressão (gzip/brotli): as respostas do painel são JSON grande e repetitivo
//     (matriz com 148 disciplinas, histórico, auditoria) — comprime muito bem;
//  2. ETag + 304: o grafo do curso quase não muda, então revalidação condicional evita
//     retransmitir o corpo inteiro a cada navegação;
//  3. under-pressure: sob fila de eventos travada ou memória estourando, devolve 503 com
//     Retry-After em vez de degradar em silêncio — e alimenta /health com o estado real.
import fp from "fastify-plugin";
import compress from "@fastify/compress";
import etag from "@fastify/etag";
import underPressure from "@fastify/under-pressure";

export const performancePlugin = fp(async (app) => {
  // threshold: abaixo de ~1KB o overhead de comprimir não compensa.
  await app.register(compress, { global: true, threshold: 1024, encodings: ["br", "gzip", "deflate"] });

  // ETag fraco: barato de calcular e suficiente para revalidação de JSON.
  await app.register(etag, { weak: true });

  await app.register(underPressure, {
    maxEventLoopDelay: 1000,          // ms de atraso do event loop
    maxHeapUsedBytes: 512 * 1024 * 1024,
    maxRssBytes: 768 * 1024 * 1024,
    retryAfter: 15,
    message: "servidor sob carga — tente novamente em instantes",
    // expõe o estado (event loop, heap, RSS) para o painel de monitor
    exposeStatusRoute: {
      routeOpts: { logLevel: "warn" },
      url: "/health/pressure",
    },
  });
});
