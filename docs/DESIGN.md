# Design e origem do frontend

**Versão atual: v11.** O frontend em `web/` usa como fundação dois templates abertos da
[Tremor](https://tremor.so) (componentes e templates para dashboards), ambos sob a licença MIT:

- **[tremorlabs/template-dashboard](https://github.com/tremorlabs/template-dashboard)**: o
  **app** (painel do aluno e administração);
- **[tremorlabs/template-solar](https://github.com/tremorlabs/template-solar)**: o **site
  público** (a página inicial).

A tela de entrada vem do **[tremorlabs/template-overview](https://github.com/tremorlabs/template-overview)**,
da mesma família e também MIT. O aviso de licença e a lista do que foi copiado estão em
[`web/THIRD_PARTY_NOTICES.md`](../web/THIRD_PARTY_NOTICES.md).

> Por que templates prontos, e estes: a versão anterior (v10) foi desenhada "do zero" e caiu
> no visual genérico de interface gerada por IA (fundo escuro com neon, grade de pontos, brilho
> borrado, cartões com ícone em azulejo, bento). O pedido foi partir de um template real, feito
> por designers, e não ter "cara de gerado por IA". A escolha entre Solar + Dashboard, Database +
> Dashboard e só o Dashboard foi feita pelo dono do projeto, com as imagens dos próprios
> repositórios.

---

## 1. O que veio de cada template

| Template | Peça | Onde está |
| --- | --- | --- |
| Dashboard | Componentes **Tremor Raw**: Button, Badge, Divider, Label, Input, Checkbox, Dropdown, Drawer, Dialog, TabNavigation, Table, ProgressBar, ProgressCircle, LineChart (recharts), Searchbar, CommandBar (o desenho do Card vive em `components/ui`) | `src/components/tremor/` |
| Dashboard | Sidebar fixa de 18 rem (`lg:w-72`), branca com borda; barra superior no mobile com a gaveta | `src/components/layout/sidebar.tsx`, `mobile-sidebar.tsx`, `nav-links.tsx` |
| Dashboard | "Workspace dropdown", que virou o **seletor de curso** (matrícula), com o período letivo no subtítulo | `layout/course-switcher.tsx` |
| Dashboard | Menu de perfil com **tema Claro / Escuro / Sistema**, agora salvo na conta | `layout/user-profile.tsx` |
| Dashboard | Overview: `ProgressBarCard`, `CategoryBarCard` e `ChartCard`, em seções sem caixa (gap-14) | `components/overview/cards.tsx`, `app/painel/page.tsx` |
| Dashboard | Details: **DataTable** (TanStack) com seleção, ordenação, paginação, ações por linha e barra de comandos em lote | `components/data-table/`, `app/painel/disciplinas/page.tsx` |
| Dashboard | Settings: abas (`TabNavigation`) e seções com título à esquerda e formulário em 2/3 | `app/config/page.tsx` |
| Solar | Barra flutuante, herói com o "Jogo da Vida" em pontos, título de 8xl com tracking apertado, botão em degradê | `components/site/navbar.tsx`, `hero.tsx`, `game-of-life.tsx` |
| Solar | Grade de recursos com guias tracejadas, hachura diagonal, órbita, grade de sensores e chip pulsante | `components/site/features.tsx`, `orbit.tsx`, `chip-viz.tsx`, `feature-divider.tsx` |
| Solar | Seção escura com bordas hachuradas, painel inclinado em 3D, StickerCards, chamada final e rodapé | `components/site/curriculum-map.tsx`, `analytics.tsx`, `sticker-card.tsx`, `cta.tsx`, `footer.tsx` |
| Overview | Tela de entrada: coluna estreita, grade de quadradinhos com máscara radial, placa com quatro parafusos | `app/(auth)/layout.tsx` |

O **conteúdo** foi trocado pelo do Painel: os veículos que orbitam no Solar viraram disciplinas
com sua situação; os sensores de temperatura viraram disciplinas na grade; o mapa da fazenda
virou um mapa curricular; o "ciclo de cobrança" do Dashboard virou a integralização.

## 2. O que mudou em relação aos templates, e por quê

### Acento: índigo → laranja, em tons escolhidos por contraste

O Dashboard usa índigo; o Solar, laranja. Ficou o laranja nos dois. Os tons do template não
passam no WCAG AA com texto branco. Contraste calculado na paleta oklch do Tailwind v4:

| Combinação | Contraste | AA (≥ 4,5) |
| --- | --- | --- |
| branco sobre `orange-500` (botão do Solar) | 2,89 | não |
| branco sobre `orange-600` | 3,59 | não |
| branco sobre `orange-700` | 5,23 | sim |
| `orange-700` como texto sobre branco / `gray-50` | 5,23 / 5,01 | sim |
| `gray-950` sobre `orange-500` (botão no escuro) | 6,96 | sim |
| `orange-400` como texto sobre `gray-950` | 8,46 | sim |

Daí: **botão primário e texto de acento em `orange-700`** no claro; **`orange-500` com texto
`gray-950`** e texto em `orange-400` no escuro; barras e marcas gráficas em `orange-600`
(3,59:1, acima dos 3:1 exigidos para elementos gráficos). O degradê do botão do herói vai de
`orange-600` a `orange-700` com `via-orange-700`: o meio, onde fica o texto, é o tom que passa.

### Texto secundário no escuro

A Tremor usa `gray-500` para texto secundário também no escuro, o que dá 4,16:1 sobre `gray-950`.
Nos componentes portados e nas páginas ele virou `gray-400` (7,73:1). Placeholder: de `gray-400`
(2,6:1) para `gray-500` no claro.

### Sem as imagens do Solar e sem depoimento inventado

As ilustrações do Solar (fazenda solar, nuvens, drone) **não** foram usadas. Elas mostram a
marca do template e têm justamente o estilo de pintura que lembra imagem gerada por IA. A seção
"Testimonial" trazia a citação de uma pessoa fictícia; no lugar dela entrou o mesmo desenho
(aspas penduradas, frase em negrito com continuação esmaecida) com uma afirmação verificável:
a regra de cálculo do próprio painel (RN-03). O painel inclinado mostra um histórico **de
exemplo**, identificado como tal.

### Portando do Tailwind v3 para o v4

O Dashboard é Tailwind v3; o Painel já era v4. O port renomeou a escala deslocada
(`shadow-sm` → `shadow-xs`, `rounded` → `rounded-sm`, `outline-none` → `outline-hidden`,
`ring` → `ring-3`, `placeholder-*` → `placeholder:text-*`) e os nomes de animação para
kebab-case, com as keyframes declaradas em `@theme` (`globals.css`).

Um caso que não é renomeação: o `Dialog` centraliza com `-translate-x-1/2`, que no v4 vira a
**propriedade** `translate`, e a keyframe original animava `transform: translate(-50%, …)`. As
duas se somariam e o diálogo pularia ao abrir. A keyframe agora anima `translate` e `scale`.

### Outros ajustes

- **Barra de comandos em lote**: os atalhos de uma letra do template escutam o documento
  inteiro. Com linhas selecionadas, digitar "e" na busca acionava "Edit". Agora ignoram teclas
  digitadas em campos e combinações com Ctrl/Alt/⌘; os botões têm nome acessível exato e
  `aria-keyshortcuts`.
- **Cabeçalho de coluna ordenável**: era `<div onClick>`; virou `<button>` (teclado).
- **Gaveta**: o botão de fechar não tinha rótulo; ganhou `aria-label="Fechar"`.
- **StickerCard**: era um `<a>` sem destino; virou bloco estático.
- **`motion` → CSS**: o `<Fade>` e o pulso do `ChipViz` usavam a biblioteca `motion`. Foram
  refeitos com `@keyframes` (`fadeBlurUp`, `chipPulse`), e o conteúdo termina visível mesmo sem
  JavaScript.
- **Jogo da Vida**: com `prefers-reduced-motion` desenha um quadro e para; fora da tela, pausa.
- **Site sempre claro**: o Solar não tem modo escuro, mas usa componentes Tremor com variantes
  `dark:`. Com o sistema no escuro, isso poria texto claro em fundo claro. A rota `/` força o
  tema claro (`forcedTheme` do next-themes).

## 3. Decisões estruturais

### Tema: segue o sistema

`ThemeProvider defaultTheme="system"`, como no Dashboard. A escolha da pessoa (Claro / Escuro /
Sistema), no menu de perfil ou em Ajustes, é salva na conta (`PATCH /me/settings`,
`theme: "dark" | "light" | "system"`). O padrão de **contas novas** passou a ser `"system"`
(migração `20261102040000_tema_sistema`). Contas antigas mantêm o valor que já tinham: não dá
para distinguir quem escolheu "escuro" de quem só herdou o padrão anterior.

### Duas gerações de componentes, um desenho só

As telas reescritas usam os componentes Tremor direto (`components/tremor/*`, paleta `gray-*`).
As páginas que não foram reescritas usam as primitivas de `components/ui/`, que mantêm a API
antiga mas agora desenham com as mesmas classes. Os tokens semânticos do `globals.css`
(`bg-card`, `text-muted-foreground`…) apontam para os mesmos cinzas da Tremor.

> **`@theme inline` continua obrigatório.** Sem o `inline`, o Tailwind resolve a cor no build e
> os utilitários com opacidade congelam no valor de um dos temas.

### Fontes

**Inter** no app (como o Dashboard) e **Geist** no site (como o Solar), ambas auto-hospedadas
por `next/font`.

### Gráficos

O `LineChart` da Tremor usa **recharts** (v2, a versão do template). As peças pequenas
(BarList, barra empilhada, anel) continuam sem biblioteca, em `components/charts`.

### Por que o painel roda no cliente

O refresh da sessão vive num cookie `httpOnly` emitido pela API, em **outra origem** (`:3333`).
Um Server Component do Next não recebe esse cookie, então não teria como renovar a sessão nem
buscar dados autenticados no servidor. Server Components cuidam da casca (site, layouts,
metadados); o painel e a administração são Client Components com TanStack Query.

### Acessibilidade

- `Field` e os formulários associam rótulo e controle por `htmlFor`/`id`.
- Navegação principal em `<nav aria-label="Navegação principal">`, item atual com `aria-current`.
- Componentes Radix (Dropdown, Dialog, Drawer, Popover da barra de lote) trazem foco preso, Esc e papéis ARIA.
- A grade do cronograma implementa o padrão ARIA `grid` com *roving tabindex*.
- Toda animação respeita `prefers-reduced-motion`.
- O E2E `visual.spec.ts` cobra o contraste do texto secundário nos dois temas (convertendo a
  cor oklch para sRGB pelo próprio navegador) e o destaque do item ativo.

## 4. Histórico das versões de design

| Versão | O que era | Por que mudou |
| --- | --- | --- |
| v4–v5 | SPA Vite, mosaico bento, numerais fantasma | pedidos sucessivos de "mudança drástica" |
| v6 | barra lateral em gradiente + "app-card" flutuante | referência da qual o usuário gostou |
| v7 | trilho superior, tela cheia, cantos vivos | rejeitada: "muito pior, inferior à v6" |
| v8 | volta da casca da v6, agora em Tailwind v4 | pedido de "se basear em Next.js e Tailwind" |
| v9 | frontend novo em Next.js a partir de seis templates (paleta cerrado/poente, Fraunces + Sora) | rejeitada: "detesto o atual" |
| v10 | "Bancada": escuro, neon ciano, grade de pontos (não publicada) | rejeitada: "exatamente como eu detesto", com cara de gerado por IA |
| **v11 (atual)** | **templates Tremor: Dashboard no app, Solar no site, Overview no login; acento laranja** | pedido de usar um template real como fundação |

A lição das rodadas: **desenho inventado a partir de "estilo" tende ao genérico**. Partir de um
template real, feito por designers, e mudar só o conteúdo e o necessário (contraste, idioma,
acessibilidade) preserva o que dá personalidade a ele.
