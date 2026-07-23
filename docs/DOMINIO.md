# O domínio acadêmico — guia completo

Este documento explica **o problema que o Painel Acadêmico resolve** e como cada conceito do mundo
real (matriz curricular, requisitos, integralização, horários SIGAA) vira código. É a leitura
recomendada antes de mexer em `backend/src/domain/` — a lógica ali é a alma do sistema, e cada
regra tem uma razão de existir.

> Contexto: o sistema nasceu para acompanhar a matriz **ENGCO-BI-2 2021.1** (Engenharia de
> Computação, UFG), mas todo o modelo é parametrizado para qualquer curso com estrutura semelhante
> (RF-13). Nada de específico da UFG está fixo no código — está nos **dados** (JSON da matriz).

---

## 1. A matriz curricular

Uma matriz curricular é o "mapa" oficial do curso: a lista de disciplinas, suas cargas horárias,
seus pré-requisitos e as regras de contabilização para a formatura. No sistema, uma matriz é um
`Course` com três coleções:

| Entidade | O que representa | Exemplo real |
| --- | --- | --- |
| `Subject` | Uma disciplina da matriz | `IME0351 — Álgebra Linear, 64h` |
| `CompositionRequirement` | Um "balde" de horas exigidas | `NL — Núcleo Livre, 128h` |
| `Milestone` | Um marco de horas integralizadas | `CH1 — 1200h` |

### 1.1 O número de sequência (`seq`)

Cada disciplina tem um `seq` — sua posição na matriz oficial (1..120 na ENGCO-BI-2). Ele é a
**chave de referência estável** do domínio:

- os **requisitos** apontam para `seq` (não para id de banco), igual ao PDF oficial da matriz;
- o **backup do usuário** (RF-16) serializa status por `seq`, então sobrevive a re-importações
  da matriz (os ids de banco mudam, o `seq` não);
- o **seed** e o formato de importação usam `seq` como identidade (`@@unique([courseId, seq])`).

Regra prática: dentro do domínio puro, disciplinas são identificadas por `seq`; ids de banco só
aparecem na borda HTTP/Prisma (ex.: `PUT /subjects/:subjectId`).

### 1.2 Núcleos e optativas

Cada disciplina pertence a um núcleo (`nucleus`):

- **NC** (Núcleo Comum) — a base compartilhada das engenharias (cálculos, físicas, químicas…);
- **NE** (Núcleo Específico) — o que é da computação.

Dentro do NE, `groupOpt` separa obrigatórias de optativas:

- `groupOpt = 0` → disciplina **obrigatória**;
- `groupOpt = 2..5` → disciplina **optativa** daquele grupo (a matriz organiza as optativas em
  grupos temáticos; hoje o número do grupo é informativo, mas fica registrado para regras futuras
  do tipo "no mínimo X horas do grupo 3").

Essas duas propriedades decidem **em qual balde** as horas de uma disciplina aprovada caem
(seção 2) e se ela conta como "obrigatória" no ranking de recomendações (seção 4).

---

## 2. Integralização: composições, mínimos e excedente

"Integralizar" é cumprir todas as exigências de horas do curso. As exigências são divididas em
**composições** — e aqui mora a regra mais sutil do sistema.

### 2.1 As cinco composições da ENGCO-BI-2

| Key | Nome | Mínimo | De onde vêm as horas |
| --- | --- | --- | --- |
| `NC` | Núcleo Comum | 1600h | disciplinas da matriz com `nucleus=NC` aprovadas |
| `NEO` | Núcleo Específico Obrigatório | 1984h | matriz, `nucleus=NE` e `groupOpt=0` |
| `OPT` | Núcleo Específico Optativo | 320h | matriz com `groupOpt>0` **+ extras categoria OPT** |
| `NL` | Núcleo Livre | 128h | **somente extras** categoria NL (cursadas fora da matriz) |
| `AC` | Atividades Complementares | 100h | **somente extras** categoria AC (extrato de horas) |

Total exigido: **4132h** (= soma dos mínimos; também gravado em `Course.totalHours`).

O modelo é **linhas, não colunas**: outro curso pode ter composições diferentes (`ESTAGIO`,
`TCC`…) sem mudar o schema — basta importar outra matriz (RF-13). A função `minimumsFrom()` em
`progress.ts` converte as linhas do banco no objeto de mínimos que `sums()` consome.

### 2.2 A regra do teto (a mais importante do sistema)

> **Horas além do mínimo de uma composição não adiantam a formatura em outra.**

Exemplo real do perfil semeado: o aluno tem **286h de Núcleo Livre** — mas o mínimo de NL é
**128h**. As 158h excedentes:

- **ficam registradas** e aparecem na UI como `286/128h (+158h)` — valor real preservado;
- **não empurram** o total integralizado — para a formatura, NL contribui com `min(286,128)=128h`.

Em código (`sums.ts`), cada composição vira um `CompositionSum`:

```ts
{ raw: 286, min: 128, counted: 128, excess: 158 }   // NL do perfil semeado
```

E o total integralizado é `Σ counted` — **nunca** `Σ raw`:

```
NC:  736 raw / 1600 min -> conta 736
NEO: 496 raw / 1984 min -> conta 496
OPT:   0 raw /  320 min -> conta   0
NL:  286 raw /  128 min -> conta 128   (+158 excedente)
AC:  219 raw /  100 min -> conta 100   (+119 excedente)
                     total integralizado = 1460h
```

Por que assim? Porque é como a universidade contabiliza: cursar Núcleo Livre "a mais" enriquece o
histórico, mas não substitui as horas obrigatórias que faltam. A UI reflete a dupla natureza:
a **barra** trava em 100% (exibição), o **excedente** aparece em verde (registro), e o **total**
usa só o que conta.

> Armadilha histórica: a primeira versão somava os `raw` no total (1737h no perfil) — os testes
> em `test/unit/progress.test.ts` documentam a diferença com números exatos para ninguém regredir.

### 2.3 Marcos de horas (CH1..CH3)

Alguns cursos destravam disciplinas por **horas integralizadas**, não por disciplina específica:

| Marco | Horas | O que destrava (ENGCO-BI-2) |
| --- | --- | --- |
| CH1 | 1200h | Eng. de Software 1, Linguagens Formais, Paradigmas… |
| CH2 | 2144h | Estágio Supervisionado |
| CH3 | 2400h | Projeto Final de Curso 1 |

Um marco é atingido quando o **total integralizado (limitado!)** cruza suas horas. No grafo, um
requisito pode ser `pre: ["CH1"]` — string = `milestoneKey`, número = `seq` de disciplina.

---

## 3. O grafo de requisitos e o status de cada disciplina

### 3.1 Pré-requisito vs co-requisito

- **PRE**: precisa estar **aprovada antes**. `Cálculo 2A` tem `pre:[5]` (Cálculo 1A).
- **CO**: pode ser cursada **junto**. Se `Física 2` tem `co:[F1]`, você pode matricular as duas
  no mesmo período.

### 3.2 Os quatro estados calculados (`statusOf`)

Para cada disciplina, dado o conjunto de aprovadas e as horas integralizadas:

| Status | Significado | Regra |
| --- | --- | --- |
| `done` | aprovada | `seq ∈ approved` |
| `lock` | bloqueada | algum PRE não cumprido (disciplina não aprovada ou marco não atingido) |
| `co` | quase | PREs ok; falta co-requisito, mas o co-requisito está destravável |
| `avail` | disponível | PREs ok e COs aprovados (ou sem requisitos) |

O caso `co` merece atenção: se falta um co-requisito cujos próprios PREs **não** estão cumpridos,
a disciplina é `lock` (você não conseguiria matricular as duas juntas de qualquer forma). Essa
nuance está em `graph.ts:statusOf` e coberta por teste.

### 3.3 Exemplo passo a passo

Matriz mínima (a mesma dos testes):

```
1 ──pre──> 2 ──pre──> 3        4 (co: 1)        5 (pre: CH1=1200h)
```

Com `approved={1}` e 200h integralizadas:

- `1` → done · `2` → avail (pré 1 ok) · `3` → lock (pré 2 falta)
- `4` → co (falta o co-requisito 1? não — 1 aprovada → avail!) — atenção: co aprovado conta
- `5` → lock (200h < 1200h do CH1)

### 3.4 Recomendações por destravamento (RF-07)

Pergunta que o painel responde: *"qual disciplina disponível devo priorizar?"*. Resposta: a que
**destrava mais coisas** transitivamente.

`buildDeps()` inverte o grafo (quem depende de quem) e `unlockCount(seq)` faz uma busca em
profundidade contando quantas disciplinas pendentes são alcançáveis a partir daquela — separando
`ob` (obrigatórias) de `tot` (todas). O ranking ordena por `ob` desc, depois `tot` desc.

Exemplo real com o perfil zerado: `Cálculo 1A` destrava **63 disciplinas (27 obrigatórias)** —
por isso é a recomendação nº 1 de um calouro. Disciplinas **já marcadas** (aprovadas, cursando
ou simuladas) saem do ranking: não faz sentido recomendar o que você já encaminhou.

---

## 4. Os três estados persistidos de uma disciplina (RF-06/19)

Além do status **calculado** (seção 3), o aluno **marca** disciplinas com um estado persistido:

| Estado | Semântica | Conta no oficial? | Conta na projeção? | Sai das recomendações? |
| --- | --- | --- | --- | --- |
| `APPROVED` | aprovada no histórico | ✅ | ✅ | ✅ |
| `ENROLLED` | **cursando agora** | ❌ | ✅ | ✅ |
| `SIMULATED` | planejada ("e se?") | ❌ | ✅ | ✅ |
| *(ausente)* | pendente | ❌ | ❌ | ❌ (aparece) |

O painel sempre mostra **dois números**: o **oficial** (só APPROVED — o que a universidade
reconhece hoje) e o **projetado** (oficial ∪ cursando ∪ simuladas — "onde chego se tudo der
certo"). O estado `ENROLLED` existe para o semestre corrente: suas matérias em curso contam no
plano, mas não no histórico — quando o resultado sair, um clique promove para `APPROVED`.

No banco: `SubjectStatus(enrollmentId, subjectId, state)` com unicidade por par — a ausência da
linha é o estado "pendente" (não há enum PENDING).

---

## 5. Componentes extras (RF-08/09)

Nem tudo que conta para a formatura está na matriz. `ExtraComponent` registra:

| Categoria | O que é | Efeito nas somas |
| --- | --- | --- |
| `NC` | reclassificação: conta como Núcleo Comum | soma em NC |
| `NE` | reclassificação: conta como Núcleo Específico obrigatório | soma em NEO |
| `OPT` | optativa / **NE optativa** (fora das tabelas da matriz) | soma em OPT (⚠️ equivalência depende da coordenação) |
| `NL` | disciplina de Núcleo Livre (qualquer curso da universidade) | soma em NL |
| `AC` | horas de Atividades Complementares (extrato) | soma em AC |
| `NONE` | registro sem horas contáveis (estágio, IC, ligas) | não soma — é memória do histórico |

**Reclassificação:** a categoria de qualquer extra é editável (na página Extras, um select por
linha) — assim um Núcleo Livre pode ser convertido em `NC`, `NE` ou `OPT` (NE optativa) e passa a
somar na composição correspondente.

Cada extra tem `status` (planejado | em andamento | concluído), espelhando os estados de disciplina:
**Concluído** soma no oficial e na projeção; **Em andamento** soma **só na projeção** (como
CURSANDO); **Planejado** não soma em nada — serve para anotar intenções sem poluir os números.

---

## 6. Horários SIGAA e o cronograma (RF-10/11/12)

### 6.1 O código de horário

O SIGAA (sistema acadêmico da UFG e de várias federais) codifica horários assim:

```
24M12  =  dias 2 e 4 (seg/qua) · turno M (matutino) · aulas 1 e 2
56T34  =  qui/sex · tarde · aulas 3 e 4
7N12   =  sábado · noite · aulas 1 e 2
```

- Dias: `2`=segunda … `7`=sábado (como no calendário brasileiro acadêmico).
- Turnos: `M` (7h10–12h30, 6 aulas), `T` (13h10–18h30, 6 aulas), `N` (18h05–22h00, **5** aulas).
- Vários blocos separados por espaço: `"2M12 4T34"`.

`parseSIGAA()` expande o código em *slots* (`"2-M1"`, `"2-M2"`, `"4-T3"`…) e devolve os tokens
inválidos em `errs` (dia 8? aula N6? formato quebrado?). A validação roda **no cliente** (feedback
imediato) e **no servidor** (fonte de verdade — RN "nunca confie no cliente").

### 6.2 Cenários e pintura

Um `Scenario` é uma hipótese de grade ("Plano A", "Se eu pegar EDO à noite"): disciplinas com
código SIGAA + células **pintadas** (categorias pessoais: estudo, trabalho…). A grade é uma tabela
17 slots × 6 dias; disciplinas ocupam células (pela expansão do código) e a pintura marca o resto.
A célula pintada persiste por `cellKey` (`"2-M1"`) com upsert; repintar com a mesma categoria
limpa. A grade é navegável por teclado (padrão ARIA grid — ver `docs/ARQUITETURA.md` §UI).

`conflicts(a, b)` calcula a interseção de slots de dois códigos — a base para sinalizar choque de
horário (backlog de UI).

---

## 7. Período letivo e férias (RF-20 v2 — calendário global)

O período letivo corrente é **um só para toda a instância** e vem de um **calendário acadêmico
agendável** que só os admins editam (`AcademicPeriod`). Cada entrada é uma *virada*: numa data
(`startsAt`) começa um `TERM` (com rótulo, ex.: `2026.2`) ou um `BREAK` (férias, `term=null`).

`resolvePeriod(rows, now)` (`domain/period.ts`, puro):
- **corrente** = última entrada com `startsAt <= now`; `onBreak` quando é `BREAK`.
- **próximo** = próxima entrada futura (`nextStartsAt`) e o próximo `TERM` (`nextTerm`).
- **sem calendário** → `heuristic(now)` sugere pelo mês (mar–jul → `.1` · ago–dez → `.2` ·
  jan/fev → férias); `source:"heuristic"` sinaliza a sugestão. O servidor resolve e expõe em `GET /me`.

Exemplo real (o do próprio usuário): `2026.1` em curso → **06/07 começam as férias** → **10/08
começa o `2026.2`** → férias → `2027.1`… O aluno mantém só o **período de ingresso** (`startTerm`)
na matrícula; `currentTerm` foi removido (o PATCH da matrícula é `.strict()` e rejeita a chave).
A UI (`Topbar`) mostra o chip global; o admin gere a linha do tempo em `/admin/periodos`.

---

## 8. Formato de importação de matriz (RF-13)

O mesmo JSON alimenta o seed e `POST /courses/import`:

```jsonc
{
  "course": { "slug": "engcomp-ufg-2021", "name": "Engenharia de Computação — UFG" },
  "totalHours": 4132,
  "requirements": [ { "key": "NC", "label": "Núcleo Comum", "hours": 1600 } /* … */ ],
  "milestones":   [ { "key": "CH1", "hours": 1200, "description": "Destrava …" } ],
  "subjects": [
    { "seq": 1, "code": "IME0351", "name": "Álgebra Linear", "hours": 64,
      "nucleus": "NC", "groupOpt": 0, "pre": [], "co": [] },
    { "seq": 74, "code": "INF0018", "name": "Eng. de Software 1", "hours": 64,
      "nucleus": "NE", "groupOpt": 0, "pre": ["CH1", 51], "co": [] }
  ]
}
```

Regras do importador (`importCourse.ts`):

- **idempotente**: reexecutar atualiza em vez de duplicar (upsert por `slug`/`key`/`seq`);
- **transacional**: ou a matriz inteira entra, ou nada (sem curso meio-importado);
- requisitos são recriados em lote (`deleteMany` + `createMany` — 1 round-trip, não ~200);
- referências órfãs (`pre: [999]` sem seq 999) são **ignoradas** com aviso — não viram lixo;
- ao final, o **cache do grafo** daquele curso é invalidado.

> Matrizes prontas (Elétrica 2023, Mecânica 2018) e o template vivem em [`matrizes/`](../matrizes/)
> com notas de validação por curso. Ferramentas: `npm run validar -- ../matrizes/arquivo.json`
> (schema + integridade + somas) e `npm run matrizes` (importa todas). O CI revalida e importa cada
> matriz commitada em `backend/test/integration/matrizes.test.ts`.

### Checklist para transcrever uma matriz nova

1. Liste as disciplinas com `seq` = posição na matriz oficial (não invente números).
2. Requisitos por `seq` (confira duas vezes — é o erro mais comum) ou `milestoneKey`.
3. `nucleus`/`groupOpt` conforme a tabela do PPC do curso.
4. Composições com as chaves que o curso usa (o sistema não exige NC/NEO/…, mas o par
   o domínio mapeia essas cinco por padrão — chaves novas aparecem nas barras do mesmo jeito).
5. Valide localmente: `POST /courses/import` responde a contagem de disciplinas; abra a aba
   Disciplinas e confira uns 3 requisitos por amostragem contra o PDF oficial.

---

## 8.5 Histórico, média e conquistas (RF-22/23)

Quando o aluno lança **nota**, **faltas** e o **período** em que cursou, o mesmo `SubjectStatus`
passa a alimentar o histórico escolar — sem tabela nova.

**A média é ponderada pela carga horária**, como nas federais:

```
média = Σ(nota × CH) / Σ(CH)    — só disciplinas APROVADAS e COM nota lançada
```

Uma disciplina de 96h pesa três vezes mais que uma de 32h. Isso vale por período e no global
(a MGA). Duas decisões que evitam mentir sobre o desempenho:

- **sem nenhuma nota lançada, a média é `null`, nunca `0`** — "não informado" e "tirou zero" são
  coisas diferentes, e a UI mostra "—";
- disciplinas **sem nota** ainda somam carga horária no período (o aluno cursou), mas ficam fora
  do cálculo da média.

Status sem `term` informado entram num balde "sem período": contam horas, mas não aparecem na
linha do tempo — o que evita inventar um período que o aluno não declarou.

**Ritmo e estimativa de formatura.** A média de CH aprovada nos últimos períodos, dividida pelas
horas que faltam, estima quantos períodos restam. É uma projeção honesta, não uma promessa: com
histórico curto ela oscila muito (um único período de 64h registrado projeta dezenas de períodos).
Já integralizado devolve `0`; sem histórico nenhum devolve `null` em vez de um número inventado.

**Conquistas** (`domain/achievements.ts`) são **derivadas a cada leitura e nunca gravadas**. Mesma
entrada, mesmas conquistas — não há estado a migrar, a sincronizar nem a corromper. Mudar um
limiar reclassifica todo mundo instantaneamente, sem script de migração.

---

## 9. Backup portátil (RF-16)

O export serializa **tudo que é do usuário** — status por `seq`, extras, cenários (disciplinas +
pinturas), tema e períodos — num JSON versionado (`version: 1`). O import é transacional e
**substitui** o estado de cada matrícula presente no arquivo (casada por `courseSlug`); cursos que
não existem na instância são pulados e reportados. Como tudo referencia `seq`/`slug` (nunca ids),
um backup exportado numa instância pode ser importado em outra — útil para migrar do protótipo,
trocar de servidor ou clonar o próprio perfil num ambiente de teste.

---

## 10. Onde cada regra vive (mapa rápido)

| Regra | Arquivo | Teste |
| --- | --- | --- |
| Teto por composição / total limitado | `domain/sums.ts` | `unit/progress.test.ts` |
| Status done/avail/co/lock | `domain/graph.ts:statusOf` | `unit/graph.test.ts` |
| Destravamento transitivo | `domain/graph.ts:unlockCount` | `unit/graph.test.ts` |
| Efeitos de APPROVED/ENROLLED/SIMULATED | `domain/progress.ts` | `integration/features.test.ts` |
| Parser SIGAA | `domain/sigaa.ts` | `unit/sigaa.test.ts` |
| Período/férias | `domain/period.ts` | `unit/period.test.ts`, `integration/features.test.ts` |
| Histórico por período / MGA / ritmo | `domain/history.ts` | `unit/history.test.ts` |
| Conquistas (derivadas) | `domain/achievements.ts` | `unit/history.test.ts` |
| Contexto único da matrícula | `modules/progress/service.ts` | `integration/gestao.test.ts` |
| Cifra de campo (PII em repouso) | `lib/fieldCrypto.ts` | `unit/cache.test.ts`, `integration/seguranca.test.ts` |
| Importação idempotente | `domain/importCourse.ts` | exercido por todos os testes de integração |
| Backup portátil | `lib/backup.ts` | `integration/account.test.ts` (roundtrip) |

> O frontend espelha `graph/sigaa` em `web/src/lib/` **apenas** para feedback imediato
> na grade; o servidor sempre recalcula. Se mudar um, mude o outro (ou extraia um pacote comum —
> backlog).

---

## 11. Glossário rápido

| Termo | Significado no projeto |
| --- | --- |
| **Matriz (curricular)** | O conjunto oficial de disciplinas/regras de um curso; no sistema, um `Course` importado por JSON |
| **`seq`** | Posição da disciplina na matriz oficial; a identidade estável do domínio |
| **Composição** | "Balde" de horas exigidas (NC, NEO, OPT, NL, AC); linha de `CompositionRequirement` |
| **Integralização** | Progresso rumo à formatura; soma das contribuições **limitadas ao mínimo** de cada composição |
| **Excedente (`excess`/`over`)** | Horas acima do mínimo de uma composição — registradas, exibidas, mas não contam no total |
| **Marco (CH1..CH3)** | Limiar de horas integralizadas que destrava disciplinas (`Milestone`) |
| **PRE / CO** | Pré-requisito (antes) / co-requisito (junto) — linhas de `Requisite` |
| **done/avail/co/lock** | Status **calculado** de uma disciplina pelo grafo (não confundir com o estado persistido) |
| **APPROVED / ENROLLED / SIMULATED** | Estado **persistido** que o aluno marca: aprovada / cursando / planejada |
| **Oficial × Projetado** | Números com só APPROVED × com os três estados (o "e se tudo der certo") |
| **Enrollment (matrícula)** | Vínculo usuário×curso; dono de status, extras e cenários |
| **Extra (componente)** | Item fora da matriz: categoria NC/NE/OPT/NL/AC/NONE (reclassificável) + `status` planejado/em andamento/concluído |
| **Cenário** | Hipótese de grade semanal: disciplinas com código SIGAA + células pintadas |
| **Slot** | Uma célula dia×aula da grade (`"2-M1"` = segunda, 1ª aula da manhã) |
| **Período (`2026.2`)** | Semestre letivo; **global**, resolvido do calendário acadêmico agendado (admin), com heurística de fallback |
| **Virada / calendário** | Entrada `AcademicPeriod`: numa data começa um `TERM` (rótulo) ou `BREAK` (férias); vale para todos |
| **Seed** | Script idempotente: importa a matriz de EngComp, cria o **admin sem matrícula**, a **conta-aluno** baseline e o calendário exemplo |

## 12. Perguntas frequentes de quem chega agora

**Por que o total do painel não bate com a soma das barras?**
Porque as barras mostram valores **reais** (que podem exceder o mínimo) e o total soma as
contribuições **limitadas** (§2.2). 286h de NL viram 128h no total. É intencional — e é a conta
que a universidade faz.

**Marquei uma disciplina como Cursando e o percentual não mudou. Bug?**
Não: cursando conta na **projeção** (o segundo número), não no oficial. Quando a aprovação sair,
promova para Aprovada e o oficial anda.

**Por que recomendações somem quando marco a disciplina?**
Qualquer estado (aprovada/cursando/simulada) tira a disciplina do ranking — recomendação é para
o que ainda está em aberto.

**Posso usar o sistema para outro curso/universidade?**
Sim, se o modelo casar: disciplinas com pré/co-requisitos por posição, composições de horas e
(opcionalmente) marcos por horas acumuladas. Transcreva a matriz no formato do §8 e importe.
O parser de horários assume o padrão SIGAA (federais que usam SIGAA funcionam de cara).

**O que acontece se a coordenação mudar a matriz?**
Reimporte o JSON atualizado: o importador faz upsert por `seq` e recria os requisitos. Status
dos alunos são preservados (apontam para `seq`s que continuam existindo); disciplinas removidas
da matriz levam seus status junto (cascade) — exporte backups antes de mudanças destrutivas.

**De onde vem "2026.1" no topo se eu nunca configurei nada?**
Da heurística de calendário do servidor (§7). Configure o valor real em Ajustes → Período letivo;
a partir daí o seu valor prevalece (e some o "🌴 Férias" automático).
