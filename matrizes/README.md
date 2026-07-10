# Matrizes curriculares

Matrizes prontas para alimentar o sistema (formato documentado em [`docs/DOMINIO.md §8`](../docs/DOMINIO.md)).
A matriz de **Engenharia de Computação** vive junto do seed (`backend/src/seed/matriz-engcomp-2021.json`)
por ser a baseline; as demais ficam aqui.

| Arquivo | Curso | Fonte oficial | Disciplinas | Total |
| --- | --- | --- | --- | --- |
| `matriz-engel-2023.json` | Engenharia Elétrica — UFG | Resolução CEPEC 1851/2023 (Apêndice A) | 148 (63 obrig + 85 opt) | 4164h |
| `matriz-engmec-2018.json` | Engenharia Mecânica — UFG | Resolução CEPEC 1582/2018 (Tabela 2) | 98 (70 obrig + 28 opt) | 4452h |
| `_MODELO.json` | *template didático* | — | ilustra cada recurso do formato | — |

> **Códigos SIGAA preenchidos** a partir dos relatórios "Dados da Matriz Curricular" do SIGAA
> (ENGEL-BI-2 e ENGME-BI-2). Notas: (1) códigos **variam entre matrizes** — ex.: Cálculo 2A é
> IME0356 na Elétrica, IME0080 na Mecânica/EngComp — nunca copie códigos entre cursos;
> (2) na Elétrica, *Tópicos em Eletrônica 2–5* (seqs 113–116) **não constam** no relatório SIGAA
> e ficaram sem código; (3) na Mecânica, o PPC chama a seq 48 de "Introdução à Economia" e o
> SIGAA de "Economia B" — é o mesmo componente FAC0439; (4) o SIGAA agrupa NC/NE de forma
> diferente do PPC (1920/2112 vs 1776/2256) — mantivemos a classificação do **PPC**, que é a
> fonte da estrutura; o SIGAA foi usado **só** para os códigos.

## Como validar e importar

```bash
cd backend
npm run validar -- ../matrizes/matriz-engel-2023.json   # schema + integridade + somas
npm run matrizes                                        # importa TODAS as matrizes deste diretório
# ou, numa instância no ar: painel Admin → "Importar matriz" → colar o JSON
```

O validador reprova referências órfãs (que o importador descartaria em silêncio), somas de núcleo
que não batem com as composições, ciclos de pré-requisito e `totalHours` inconsistente. O teste de
CI `backend/test/integration/matrizes.test.ts` roda as mesmas checagens em todo push — **uma matriz
commitada aqui nunca fica quebrada sem o CI acusar**.

## Notas de validação — Engenharia Elétrica (PPC 2023)

Extraída das Tabelas A1/A2/A3 do PPC e conferida linha a linha contra o texto da Resolução:

- **Somas exatas**: NC obrigatório 1824h ✓ · NEO 1856h ✓ · NEOP 256h · NL 128h · AC 100h · total 4164h ✓.
- **Marcos por horas**: CH1920 (Estágio) · CH2016 (Eng. de Segurança) · CH2400 (Economia B,
  Fund. Administração, Direito e Cidadania, Ética) · CH2496 (Projeto Final).
- **Recuperadas na revisão** (a extração original as havia perdido — nomes em duas linhas no PDF):
  - `97` Regulação e Comercialização de Energia Elétrica (PR 56, 64h)
  - `101` Técnicas de Análise de Dados na Pesquisa Científica (PR 13, 32h)
  - `153` Introdução à LIBRAS (sem PR, 64h)
- **Confirmado no PPC** (parece estranho, mas é literal): várias optativas de energia/automação têm
  PR = 45 (*Eletrônica Digital Experimental*); `44` tem CR 33; `47` tem CR 45; `63` tem PR por horas
  **e** CR 41. Não "corrija" sem conferir a Resolução.
- Buracos de numeração reais (slots de Núcleo Livre/Optativa no fluxo, não disciplinas): 22, 37,
  59, 60, 66, 67.
- Todas as optativas num único grupo (`groupOpt: 2`): a Tabela A3 é um pool único de NEOP.

## Notas de validação — Engenharia Mecânica (PPC 2018)

Extraída da Tabela 2 do PPC (diff automático + conferência dirigida):

- **Somas exatas**: NC 1776h ✓ · NEO 2256h ✓ · NEOP 192h · NL 128h · AC 100h · total 4452h ✓.
- **Marcos**: CH2720 → Estágio Supervisionado · CH3440 → Projeto Final (ambos "horas de NC+NE").
- Conferidos individualmente no PPC: `83` (80h = 3T+2P) · `36` (sem PR; CR = Física I **e**
  Probabilidade e Estatística A) · `75` (PR = Metodologia Científica + CH3440) · `77` (sem CR mesmo,
  diferente dos outros cursos) · `88` (CR = Máquinas Térmicas) · `103` (CR = Transferência de Calor 2).
- Salto de numeração 89–97 é real (confirmado no PPC).
- Atenção: o `MatrizEngMec2018.pdf` que circulou antes era a matriz de **2012** (aparece na tabela
  de equivalências do PPC) — não usar.

## Limitação conhecida (marcos "NC+NE")

Os PPCs definem os marcos contando **apenas** horas de NC+NE, enquanto o motor compara contra o
**total integralizado** (que inclui NL e AC contados, limitados aos mínimos). Como NL+AC contados
somam no máximo 228h, um marco pode liberar um pouco **antes** do que o SIGAA liberaria. É uma
aproximação consciente do modelo — confira no SIGAA antes de contar com a vaga.

## Adicionando um curso novo

1. Copie `_MODELO.json` e siga o checklist do [`docs/DOMINIO.md §8`](../docs/DOMINIO.md).
2. Transcreva do **PPC vigente** (Resolução CEPEC) — não de PDFs de terceiros.
3. `npm run validar -- ../matrizes/seu-curso.json` até zerar erros.
4. Confira ~3 requisitos por amostragem contra o PPC (o validador não lê o PDF por você).
5. Abra o PR com a fonte citada (número da Resolução) — o CI importa a matriz num banco limpo.
