# Avisos de terceiros

O frontend em `web/` foi construído sobre templates abertos da **Tremor** (Tremor Labs, Inc.).
Os três repositórios abaixo são distribuídos sob a licença MIT reproduzida no fim deste arquivo;
o aviso de copyright deles acompanha as partes copiadas ou adaptadas.

| Origem | O que foi aproveitado | Onde está no Painel |
| --- | --- | --- |
| [tremorlabs/template-dashboard](https://github.com/tremorlabs/template-dashboard) | componentes Tremor Raw (Button, Badge, Divider, Label, Input, Checkbox, Dropdown, Drawer, Dialog, TabNavigation, Table, ProgressBar, ProgressCircle, LineChart, Searchbar, CommandBar) e o desenho do Card, utilitários de gráfico, sidebar, seletor de workspace, menu de perfil, gaveta do mobile, cartões da visão geral, DataTable e o layout das configurações | `src/components/tremor/*`, `src/lib/chart-utils.ts`, `src/lib/use-on-window-resize.tsx`, `src/components/layout/*`, `src/components/overview/cards.tsx`, `src/components/data-table/*`, `src/app/config/page.tsx` |
| [tremorlabs/template-solar](https://github.com/tremorlabs/template-solar) | o site público: barra, herói com o "Jogo da Vida", grade de recursos com guias tracejadas, órbita, chip, cartões de canto dobrado, divisor, seção escura, painel inclinado, chamada final e rodapé | `src/components/site/*`, `src/app/page.tsx` |
| [tremorlabs/template-overview](https://github.com/tremorlabs/template-overview) | a tela de entrada (coluna estreita, grade de quadradinhos, placa com parafusos) | `src/app/(auth)/layout.tsx` |

Modificações feitas no Painel (resumo — detalhes em `docs/DESIGN.md`): conversão do Tailwind v3
para v4, acento índigo trocado por laranja em tons escolhidos por contraste, textos em português,
tooltip do gráfico generalizado, correção da animação do diálogo no v4, atalhos da barra de
comandos ignorados enquanto se digita, rótulos acessíveis onde faltavam e animações do `motion`
refeitas em CSS. As ilustrações e a foto do template-solar **não** foram incluídas.

---

The MIT License (MIT)

Copyright (c) 2025 Tremor Labs, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
