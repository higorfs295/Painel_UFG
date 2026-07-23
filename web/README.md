# Painel Acadêmico — frontend (Next.js)

App Router + TypeScript + Tailwind CSS v4, consumindo a API Fastify em `../backend`.

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
| `npm run e2e` | Playwright — precisa da API e do app no ar |

## Mapa de rotas

```
/                        landing pública (Server Component)
/entrar · /cadastro      autenticação            ·  grupo (auth), tela dividida
/convite/[token]         define a senha do convite
/painel                  visão geral do aluno    ┐
/painel/disciplinas                              │
/painel/extras                                   │  casca com barra lateral
/painel/cronograma                               │  (AppShell area="student")
/painel/recomendacoes                            │
/painel/historico                                │
/painel/agenda                                   ┘
/admin …                 7 telas de gestão       (AppShell area="admin")
/config · /ajuda         compartilhadas          (AppShell area="any")
```

## Estrutura

```
src/
├─ app/                    rotas (App Router); grupos (auth) e segmentos painel/ e admin/
├─ components/
│  ├─ layout/              sidebar, header, paleta de comandos, casca autenticada
│  ├─ ui/                  primitivas (button, card, chip, tabela, diálogo de risco…)
│  ├─ charts/              gráficos em SVG (donut, barras, área, empilhada)
│  ├─ marketing/           seções da landing
│  └─ schedule/            "puxar do meu semestre" (RF-29)
├─ hooks/                  queries do aluno com as chaves centralizadas
└─ lib/
   ├─ api/                 cliente HTTP, endpoints tipados, tipos e a pista de sessão
   ├─ auth-store.ts        sessão e matrícula selecionada (Zustand)
   ├─ monitoring.ts        reporte de erro opcional
   └─ csv.ts · sigaa.ts    exportação e parser de horário
```

## Decisões que valem saber

**Tudo do painel roda no cliente.** O refresh da sessão vive num cookie `httpOnly` emitido
por outra origem (a API em `:3333`); um Server Component do Next não o recebe, então
renderizar o painel no servidor deixaria a sessão sem como se renovar. Server Components
cuidam da casca estática (landing, layouts, metadados) e os dados vêm por TanStack Query.

**Gráficos em SVG, sem biblioteca.** Donut, barras, área e empilhada saem em poucas linhas,
renderizam sem JavaScript extra e herdam as cores do tema. Bibliotecas de chart tocam
`window` na importação e exigiriam `dynamic(..., { ssr: false })`.

**Tokens de cor com `@theme inline`.** Sem o `inline`, o Tailwind resolve a cor no build e
utilitários com opacidade (`bg-muted/60`) congelam num dos temas.

**`Field` associa rótulo e controle por `htmlFor`/`id`.** Com `<label>` apenas envolvendo um
`<select>`, o nome acessível vira o texto da opção selecionada ("Concluído") em vez do
rótulo ("Situação").
