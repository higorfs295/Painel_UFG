// Documentação viva da API (OpenAPI 3) em /docs. Vale mais do que parece para escala: é o
// contrato que um segundo frontend (o que vai substituir este), um app móvel ou um integrador
// consultam sem precisar ler o código — e serve de checklist ao evoluir rotas.
//
// Fica fora de produção por padrão: expor a superfície inteira da API ajuda quem ataca tanto
// quanto quem integra. Ligue com DOCS_ENABLED=true quando quiser publicá-la.
import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export const docsPlugin = fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Painel Acadêmico — API",
        description:
          "API de acompanhamento de integralização curricular. Autenticação por JWT de acesso " +
          "(15 min) + refresh opaco rotativo em cookie httpOnly.",
        version: "1.0.0",
      },
      tags: [
        { name: "auth", description: "Sessão, convite e redefinição de senha" },
        { name: "me", description: "Conta, matrículas, progresso, agenda e anotações" },
        { name: "courses", description: "Catálogo e importação de matrizes" },
        { name: "admin", description: "Gestão da instância, calendário, avisos e observabilidade" },
      ],
      components: {
        securitySchemes: {
          bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
});
