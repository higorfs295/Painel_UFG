# Frontend — Painel Acadêmico

Interface do Painel Acadêmico: SPA em React com Vite e TypeScript. Consome a API por um cliente HTTP fino com cache via TanStack Query, roteamento com React Router e estado local leve com Zustand.

> Escopo, requisitos e contrato de API na **[../ESPECIFICACAO.md](../ESPECIFICACAO.md)**. Este README cobre a estrutura e as convenções do frontend.

---

## Estrutura

``
frontend/
├── src/
│   ├── lib/                 lógica de domínio pura (sem React)
│   │   ├── sigaa.ts         parser e validação de código de horário SIGAA
│   │   ├── graph.ts         grafo de requisitos: status de disciplina e destravamento transitivo
│   │   └── sums.ts          somas por composição com teto de exibição em 100%
│   ├── api/
│   │   └── client.ts        cliente HTTP (JWT em memória + refresh via cookie httpOnly)
│   ├── components/
│   │   ├── layout/          AppHeader, NavTabs, ThemeToggle
│   │   ├── overview/        IntegralizationBus, DonutProgress, CompositionCards, RecoGrid
│   │   ├── courses/         CourseFilters, CourseTable, CourseRow, SimBar
│   │   ├── extras/          ExtraForm, ExtraList
│   │   ├── schedule/        ScenarioTabs, DisciplineForm, DisciplineList, ScheduleGrid, PaintPalette
│   │   ├── admin/           UserAdmin, CourseImport
│   │   └── ui/              Button, Card, Chip
│   ├── pages/               Login, Invite, Overview, Subjects, Extras, Schedule, Settings, Admin
│   ├── styles/
│   │   └── theme.css        design tokens (tema claro e escuro via html[data-theme])
│   └── App.tsx              roteamento + guarda de autenticação
└── package.json
``

---

## Lógica de domínio compartilhada

Os arquivos em `src/lib` são código puro, sem dependência de React, portados do protótipo e cobertos por testes. Concentram as três operações centrais: interpretar códigos SIGAA em células de grade (`sigaa.ts`), calcular o status de cada disciplina e quantas outras ela destrava (`graph.ts`), e somar carga horária por composição respeitando o teto de exibição de 100% com excedente à parte (`sums.ts`).

Essas mesmas operações são a fonte de verdade quando reexecutadas no servidor. Ao evoluir qualquer regra aqui, reflita a mudança no backend (a especificação, RNF-09, sugere extrair para um módulo compartilhado). O cliente calcula por conveniência e resposta imediata; o servidor confirma.

---

## Camada de dados

O `api/client.ts` mantém o token de acesso em memória e envia o refresh por cookie httpOnly, com `credentials: "include"`. Use-o dentro de queries e mutations do TanStack Query, uma por recurso, para ganhar cache, revalidação e estados de carregamento/erro sem esforço manual. Ao receber 401, o cliente deve tentar uma renovação via `POST /auth/refresh` e repetir a requisição uma única vez (ponto marcado como pendente no código).

---

## Temas e acessibilidade

O tema é controlado por `html[data-theme]` (claro ou escuro), com tokens de cor em `styles/theme.css`, e persiste por usuário no servidor. Ao construir componentes, use as variáveis de cor dos tokens em vez de valores fixos, para que ambos os temas funcionem. Respeite `prefers-reduced-motion` nas animações e garanta foco visível e navegação por teclado nos controles.

---

## Estado de implementação

A lógica de `src/lib` está pronta e testada. Os componentes e páginas são esqueletos nomeados conforme a especificação (§14), com um comentário indicando a responsabilidade de cada um. O protótipo HTML original serve de referência visual e comportamental fiel — replique a partir dele, agora componentizado e consumindo a API real em vez do armazenamento local do navegador.

---

## Começando

```bash
npm install
npm run dev        # interface em http://localhost:5173
```

A URL da API é lida de `import.meta.env.VITE_API_URL` (padrão `http://localhost:3333`). Defina-a em um arquivo `.env` do Vite se necessário.

---

## Notas de compilação

O `tsconfig.app.json` é estrito e moderno, com `verbatimModuleSyntax` e `erasableSyntaxOnly`. A consequência prática de `erasableSyntaxOnly` é que construções que não são puramente apagáveis em tempo de compilação — como `enum` do TypeScript — não são permitidas; prefira uniões de literais ou objetos `as const`. O `moduleResolution` é `bundler`, adequado ao Vite. Confira a compatibilidade da versão do TypeScript com as ferramentas do ecossistema ao atualizar versões maiores.
