# Painel Acadêmico — frontend (Next.js)

App Router + TypeScript + Tailwind CSS v4, consumindo a API Fastify em `../backend`.
O desenho parte de templates abertos da [Tremor](https://tremor.so) (MIT): o
**template-dashboard** no app, o **template-solar** no site público e o login do
**template-overview** — detalhes em [`../docs/DESIGN.md`](../docs/DESIGN.md) e
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

```bash
npm install
npm run dev          # http://localhost:5173
# login: painel@admin.com (admin) ou painel@aluno.com (aluno), senha do SEED
```

A API precisa estar de pé (`cd ../backend && npm run dev`). O endereço vem de
`NEXT_PUBLIC_API_URL` (ver `.env.example`); o CORS do backend já libera `http://localhost:5173`.

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento na porta 5173 |
| `npm run build` | build de produção (**pare o `dev` antes**: os dois usam `.next/`) |
| `npm run start` | serve o build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run e2e` | Playwright — precisa da API e do app no ar (`E2E_USER_PASSWORD` = senha do seed) |

## Mapa de rotas

```
/                        site público (Server Component, template-solar)
/entrar · /cadastro      autenticação            ·  grupo (auth), login do template-overview
/convite/[token]         define a senha do convite
/painel                  visão geral do aluno    ┐
/painel/disciplinas      tabela com lote/gaveta  │
/painel/mapa             mapa de pré-requisitos  │
/painel/extras                                   │  sidebar do template-dashboard
/painel/historico                                │  (AppShell area="student")
/painel/recomendacoes                            │
/painel/cronograma                               │
/painel/agenda                                   │
/painel/avisos                                   ┘
/admin …                 7 telas de gestão       (AppShell area="admin")
/config · /ajuda         compartilhadas          (AppShell area="any")
```

## Estrutura

```
src/
├─ app/                    rotas (App Router); grupos (auth) e segmentos painel/ e admin/
├─ components/
│  ├─ tremor/              componentes Tremor Raw portados (Tailwind v4, acento laranja)
│  ├─ layout/              sidebar, gaveta, seletor de curso, perfil, paleta de comandos
│  ├─ overview/            cartões da visão geral
│  ├─ data-table/          DataTable (TanStack) com seleção e barra de comandos em lote
│  ├─ site/                seções do site público
│  ├─ ui/ · charts/        primitivas das páginas antigas, com a pele da Tremor
│  ├─ subject-drawer.tsx   gaveta da disciplina (requisitos, libera, marcações, anotação)
│  └─ schedule/            "puxar do meu semestre" (RF-29)
├─ hooks/                  dados do aluno (queryKey centralizadas) e avisos
└─ lib/
   ├─ api/                 cliente HTTP, endpoints tipados, tipos e a pista de sessão
   ├─ auth-store.ts        sessão e matrícula selecionada (Zustand)
   ├─ curriculum-graph.ts  topologia da matriz (requisitos, liberadas, camadas)
   ├─ chart-utils.ts       cores e domínio dos gráficos (Tremor)
   ├─ monitoring.ts        reporte de erro opcional
   └─ csv.ts · sigaa.ts    exportação e parser de horário
```

## Decisões que valem saber

**Tudo do painel roda no cliente.** O refresh da sessão vive num cookie `httpOnly` emitido
por outra origem (a API em `:3333`); um Server Component do Next não o recebe, então
renderizar o painel no servidor deixaria a sessão sem como se renovar. Server Components
cuidam da casca estática (site, layouts, metadados) e os dados vêm por TanStack Query.

**Tema segue o sistema.** `defaultTheme="system"`; a escolha (Claro / Escuro / Sistema) é salva
na conta. O site público é sempre claro (como o template-solar) — a rota `/` força o tema.

**Contraste antes de fidelidade.** Os tons de laranja do template-solar não passam no WCAG AA
com texto branco; botões e textos de acento usam `orange-700` no claro (5,23:1). A tabela de
contrastes está em `docs/DESIGN.md`.

**Gráficos.** O `LineChart` da Tremor usa recharts; barras, anel e barra empilhada são HTML/SVG
sem biblioteca.

**Tokens de cor com `@theme inline`.** Sem o `inline`, o Tailwind resolve a cor no build e
utilitários com opacidade (`bg-muted/60`) congelam num dos temas.

**`Field` associa rótulo e controle por `htmlFor`/`id`.** Com `<label>` apenas envolvendo um
`<select>`, o nome acessível vira o texto da opção selecionada ("Concluído") em vez do
rótulo ("Situação").
