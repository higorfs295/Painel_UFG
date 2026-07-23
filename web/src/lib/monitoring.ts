"use client";

// Monitoramento de erros no cliente — padrão do template rollbar-vercel, reduzido ao que
// este projeto precisa e com uma diferença importante: **sem token, tudo vira no-op**.
//
// O template original inicializa o Rollbar sempre e falha ruidosamente sem credencial.
// Aqui o provedor é opcional: em desenvolvimento (e em qualquer instância que não
// configure `NEXT_PUBLIC_ROLLBAR_TOKEN`) os erros só vão para o console, e nenhum dado
// de aluno sai do navegador.
//
// A carga do SDK é preguiçosa: só acontece no primeiro erro, e num import dinâmico —
// nada é somado ao bundle inicial de quem nunca vê um erro.
type Level = "error" | "warning" | "info";

const TOKEN = process.env.NEXT_PUBLIC_ROLLBAR_TOKEN;
const ENV = process.env.NEXT_PUBLIC_ROLLBAR_ENV ?? "development";

export const monitoringEnabled = Boolean(TOKEN);

type RollbarLike = { error: (e: unknown) => void; warning: (e: unknown) => void; info: (e: unknown) => void };
type RollbarCtor = new (cfg: Record<string, unknown>) => RollbarLike;
let client: Promise<RollbarLike | null> | null = null;

async function getClient(): Promise<RollbarLike | null> {
  if (!TOKEN) return null;
  // `rollbar` é dependência OPCIONAL: quem não usa não instala, e o import falha em silêncio.
  // O especificador vai numa variável para o bundler não tentar resolvê-lo em tempo de build.
  const pkg = "rollbar";
  client ??= import(/* webpackIgnore: true */ pkg)
    .then((m: { default: RollbarCtor }) => new m.default({
      accessToken: TOKEN,
      environment: ENV,
      captureUncaught: true,
      captureUnhandledRejections: true,
    }))
    .catch(() => null); // pacote ausente: segue sem monitoramento
  return client;
}

/** Reporta um erro. Nunca lança — monitoramento não pode derrubar a aplicação. */
export function reportError(err: unknown, level: Level = "error") {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console[level === "error" ? "error" : "warn"]("[painel]", err);
  }
  void getClient().then((c) => { try { c?.[level](err); } catch { /* ignora */ } });
}
