# Design e origem do frontend

O frontend em `web/` foi construído a partir de **seis templates Next.js** de referência.
Este documento registra o que veio de cada um, o que foi deliberadamente deixado de fora e
por quê — para que a próxima pessoa saiba onde procurar o "porquê" de cada convenção.

---

## 1. De onde veio cada peça

| Template | O que foi aproveitado |
| --- | --- |
| **nextjs-admin-dashboard** | O esqueleto do painel: grupos de rota separando telas com e sem casca; `Sidebar` com seções, contexto próprio (`sticky` no desktop, `fixed` + overlay no mobile, `inert` quando fechada); barra superior com o cluster de ações à direita; navegação declarada como **dado** (`nav-data.ts`) em vez de JSX; `cn()` para compor classes; tokens no `@theme` do CSS, sem `tailwind.config.js`; tabelas e elementos de formulário como componentes reaproveitáveis |
| **visactor-next-template** | A **composição dos blocos de gráfico**: título com ícone + cartões de métrica ao lado do desenho (`ChartTitle` + `MetricCard`); nomes semânticos de token no estilo shadcn (`background`/`foreground`/`card`/`muted`/`border`/`primary`/`ring`); a API de variantes do `Button`; provedores de tema isolados num único componente |
| **next-partial-prerendering** | A divisão **casca estática + ilhas dinâmicas**: a landing e os layouts são Server Components, e cada bloco do painel carrega e falha sozinho, com esqueleto próprio — uma consulta lenta não segura a página |
| **solid-nextjs** | A **página pública**: cabeçalho fixo que muda ao rolar, herói, grade de recursos, passos, FAQ em acordeão, CTA e rodapé; animações com framer-motion sempre em `whileInView`; `next-themes` para o tema; `react-hot-toast` para retorno de ação |
| **rollbar-vercel** | O **provedor de monitoramento de erros** no cliente, ligado à fronteira `error.tsx` |
| **sanity-template-nextjs-clean** | A convenção de repositório: o app web num diretório próprio ao lado do backend, com README, `.env.example` e workflow de CI dedicados |

## 2. O que foi deixado de fora, e por quê

**As bibliotecas de gráfico** (ApexCharts no admin dashboard, VisActor no visactor-next-template).
Ambas tocam `window` na importação e, no App Router, exigem `dynamic(..., { ssr: false })` —
o que atrasa o primeiro desenho e soma centenas de KB ao bundle. O que este painel precisa
desenhar é modesto: anel de progresso, barras por período, linha de ritmo e uma barra
empilhada. Em SVG isso sai em ~150 linhas (`components/charts/`), renderiza no servidor,
herda as cores do tema por variável CSS e não custa JavaScript extra. **A composição dos
blocos veio do visactor; a biblioteca, não.**

**O `better-auth` + Prisma do admin dashboard.** A autenticação deste projeto já existe no
backend Fastify (JWT curto + refresh opaco rotativo com detecção de reuso, documentado em
`SEGURANCA.md`). Trocar isso por um segundo sistema de sessão dentro do Next significaria
duas fontes de verdade sobre quem está logado.

**O Sanity (CMS).** Não há conteúdo editorial para gerir: os textos da landing são do
produto e vivem no código.

**As fontes e a paleta dos templates.** A identidade do projeto — cerrado, pôr do sol e
povos indígenas, com Fraunces (display) e Sora (interface) — foi preservada. Dos templates
veio a *gramática* (nomes de token, escala de espaçamento, convenções de componente), não a
aparência.

---

## 3. Decisões estruturais

### Por que o painel roda no cliente

O refresh da sessão vive num cookie `httpOnly` emitido pela API, que está em **outra
origem** (`:3333`). Um Server Component do Next não recebe esse cookie — logo, não teria
como renovar a sessão nem buscar dados autenticados no servidor. A divisão adotada:

- **Server Components**: landing, layouts, metadados, `not-found` — tudo que é casca;
- **Client Components**: painel e administração, com TanStack Query cuidando de cache,
  revalidação e estados de carregamento.

É a mesma divisão que o visactor-next-template usa para um dashboard sobre uma API externa.

### Tokens de tema

`app/globals.css` tem três blocos: variáveis por tema (`:root` claro, `.dark` escuro) →
`@theme inline` mapeando cada uma para um token (`--color-*`) → `@layer components` com o
punhado de classes do produto.

> **`@theme inline` é obrigatório.** Sem o `inline`, o Tailwind resolve a cor em tempo de
> build e todo utilitário com opacidade (`bg-muted/60`, `border-lock/40`) congela no valor
> de um dos temas. O sintoma engana: só *algumas* cores param de trocar.

### Acessibilidade

- `Field` associa rótulo e controle por `htmlFor`/`id` (id gerado com `useId`). Com
  `<label>` apenas **envolvendo** um `<select>`, o nome acessível vira o texto da opção
  selecionada — "Concluído" em vez de "Situação".
- O `aria-label` da navegação fica no `<nav>`, não no `<aside>`.
- A grade de horário implementa o padrão ARIA `grid` com *roving tabindex*: setas movem o
  foco, Enter/Espaço pintam.
- Toda animação respeita `prefers-reduced-motion`.

---

## 4. Histórico das versões de design

| Versão | O que era | Por que mudou |
| --- | --- | --- |
| v4–v5 | SPA Vite, mosaico bento, numerais fantasma | pedidos sucessivos de "mudança drástica" |
| v6 | barra lateral em gradiente + "app-card" flutuante, CSS à mão | referência da qual o usuário gostou |
| v7 | trilho superior, tela cheia, cantos vivos | **rejeitada**: "muito pior, inferior à v6" |
| v8 | volta da casca da v6, agora em Tailwind v4 | pedido de "se basear em Next.js e Tailwind" |
| **v9 (atual)** | **frontend novo em Next.js**, a partir dos seis templates | pedido de criar um frontend novo a partir deles |

A lição que se repete: **mudar a estrutura** (posição da navegação, densidade, escala
tipográfica) conta como redesenho; trocar tokens de cor, não. E a barra lateral com o
gradiente do poente é a peça que o projeto mantém desde a v6.
