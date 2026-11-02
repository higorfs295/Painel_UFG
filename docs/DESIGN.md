# Design e origem do frontend

**Versão atual: v12 ("Tremor vivo").** A v12 mantém a fundação da v11 e acrescenta cor,
grafismos e movimento — ver a seção 0. O frontend em `web/` usa como fundação dois templates abertos da
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

## 0. v12 — "Tremor vivo"

Pedido: o painel estava "sem graça no quesito cor, estilo, elementos gráficos e animação", e a
administração tinha poucas formas de uso. Entre três direções propostas, o dono do projeto
escolheu manter a estrutura da v11 e trazer cor e grafismos **com a cor à escolha de cada
pessoa**. Para o admin, escolheu que ele **não vê nenhum dado acadêmico individual** — só
agregados por curso.

### Cor de destaque e barra lateral, por pessoa

- A escala `brand-*` (`bg-brand-600`, `text-brand-700`…) aponta para a paleta escolhida em
  Ajustes › Aparência: laranja (padrão, o do Solar), azul, violeta, verde ou rosa. O `<html>`
  recebe `data-accent`, e `globals.css` troca as variáveis `--brand-50…950` de uma vez.
- A barra lateral tem três peles (`data-sidebar`): **clara** (a do template), **escura** (a
  barra vira uma ilha do tema escuro: `.dark` só no `<aside>`) e **colorida** (o mesmo, com a
  escala de cinza remapeada para a do destaque dentro da barra — os utilitários do Tailwind v4
  leem `var(--color-gray-*)`, então seletor de curso, busca, links e perfil passam a desenhar
  em tons da cor escolhida sem nenhuma classe nova).
- A escolha fica na conta (`PATCH /me/settings` com `accent`/`sidebar`) e num `localStorage`
  lido por um script no `<head>` antes da primeira pintura (sem ele, a página piscaria em
  laranja). O site público e as telas de entrada ficam sempre no laranja (`data-accent="orange"`
  no wrapper).
- **Cores de situação são fixas** e não seguem o destaque: aprovada = verde, cursando = azul,
  simulada = violeta, disponível = âmbar, correquisito = céu, bloqueada = cinza. As composições
  também têm cor própria (NC ciano, NEO índigo, OPT fúcsia, NL lima, AC rosa). Tudo em
  `web/src/lib/palette.ts`.

### Contraste por cor de destaque

Calculado por script a partir dos valores oklch do `tailwindcss/theme.css` (v4), convertidos
para sRGB com corte simples por canal. O E2E `visual.spec.ts` mede no navegador o botão
principal nas cinco cores e nos dois temas.

| Destaque | branco sobre 700 (botão/texto) | 700 sobre gray-50 | 600 como gráfico | gray-900 sobre 400 (botão no escuro) | 400 como texto sobre gray-950 |
| --- | --- | --- | --- | --- | --- |
| laranja | 5,23 | 5,01 | 3,59 | 7,46 | 8,46 |
| azul | 6,82 | 6,54 | 5,26 | 6,73 | 7,63 |
| violeta | 7,29 | 6,98 | 5,88 | 6,22 | 7,06 |
| verde | 5,37 | 5,14 | 3,67 | 9,18 | 10,41 |
| rosa | 6,06 | 5,80 | 4,51 | 6,21 | 7,04 |

Barra colorida: texto secundário (`brand-200`) sobre `brand-800` ≥ 5,42; branco sobre
`brand-800` ≥ 7,35; item ativo (branco sobre branco 14% + `brand-800`) ≥ 5,45. Fundo cheio com
texto por cima (avatar, azulejo de iniciais) usa `solid`: 700 + branco no claro e 400 + gray-950
no escuro — o 600 com branco **não** passa em âmbar, verde, ciano e lima.

> **Correção da v11.** A tabela da v11 dizia "gray-950 sobre orange-500 (botão no escuro):
> 6,96". O texto do botão no escuro é `gray-900`, não `gray-950`: no laranja dá 6,14 (passava
> por sobra), mas no violeta daria 4,03. Na v12 o botão no escuro usa `brand-400`.

### Grafismos e movimento

Peças em `web/src/components/fx/`, todas desenhadas em código (nenhuma imagem):

- **Faixa de topo** (`PageBanner`): degradê suave do destaque, o "Jogo da Vida" do Solar como
  campo de pontos (pausa fora da tela e com a aba oculta), hachura diagonal e guia tracejada.
- **Anel de progresso** com degradê e traço que se desenha; **números que contam**; **minigráfico**
  nos cartões de número; **mapa de calor** de logins; **rosca** de várias fatias; **faixa de
  estado** por minuto no Monitor; **medalhas** nas conquistas; arte dos estados vazios.
- Barras crescem ao aparecer, grades entram em cascata, páginas entram subindo de leve, o
  esqueleto de carregamento tem brilho que corre, o Monitor tem ponto "ao vivo".
- **Confete** só em marcos de verdade: um marco de horas alcançado ou uma composição fechada em
  100% durante a sessão — nunca ao simplesmente abrir a página.
- Tudo desligado por `prefers-reduced-motion` (CSS global e checagem nos componentes em JS).

### Componentes Tremor novos

Do **template-insights** (MIT): BarChart, AreaChart, BarList, CategoryBar, Textarea, Tabs,
Accordion, Tooltip e RadioCardGroup; do template-dashboard: Switch. Mesmo port da v11 (v3 → v4),
com o índigo trocado pela escala `brand-*`.

### Armadilhas encontradas (e o conserto)

- **Gráfico de área vazio.** O recharts 2 encontra as séries pelo `react-is` (18.3 na árvore de
  dependências), que não reconhece o `Fragment` do React 19; o AreaChart da Tremor embrulhava
  cada `<Area>` num `<React.Fragment>`, e as áreas sumiam (só os eixos apareciam). O AreaChart
  agora devolve `[<defs/>, <Area/>]` como array.
- **Barra de lote fora da tela.** Com `animation-fill-mode: both`, o `transform` da animação de
  entrada continua "preenchido" depois do fim e o Chrome passa a usar o elemento como bloco de
  contenção dos filhos `position: fixed` — a barra de comandos em lote foi parar 1.200 px abaixo.
  As entradas usam `backwards`.
- **Animação no lugar errado.** A primeira tentativa de "gráficos animados" aumentou a duração
  da animação do *tooltip*; as séries é que estavam com `isAnimationActive={false}`.

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
| `gray-950` sobre `orange-500` (botão no escuro) — **premissa errada, ver a correção na seção 0** | 6,96 | sim |
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
| v11 | templates Tremor: Dashboard no app, Solar no site, Overview no login; acento laranja | pedido de usar um template real como fundação |
| **v12 (atual)** | **v11 + cor de destaque e barra lateral à escolha, cores de situação fixas, grafismos do Solar dentro do app, gráficos e movimento** | "sem graça no quesito cor, estilo, elementos gráficos e animação" |

A lição das rodadas: **desenho inventado a partir de "estilo" tende ao genérico**. Partir de um
template real, feito por designers, e mudar só o conteúdo e o necessário (contraste, idioma,
acessibilidade) preserva o que dá personalidade a ele.
