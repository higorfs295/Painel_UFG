# Painel Acadêmico Multiusuário — Especificação Técnica v2.0

> Documento de referência do projeto. Evolui o protótipo (artefato HTML de usuário único, sem backend) para uma aplicação web multiusuário com autenticação, papéis, múltiplos cursos e persistência real. Onde há incerteza factual, ela está sinalizada explicitamente (ver §15). Versões de bibliotecas citadas devem ser conferidas na documentação oficial antes de fixar.

---

## 1. Descrição geral e propósito

O Painel Acadêmico é uma ferramenta de acompanhamento de progresso curricular para estudantes de graduação. A partir da matriz oficial de um curso, do histórico do aluno e do grafo de pré e co-requisitos, o sistema responde a três perguntas que o extrato do SIGAA não responde diretamente: *quanto falta para me formar*, *o que eu posso cursar agora* e *o que é mais estratégico cursar em seguida*. Complementarmente, permite montar cenários de cronograma semanal a partir dos códigos de horário do SIGAA e registrar componentes que não constam da matriz (optativas equivalentes, Núcleo Livre, Atividades Complementares e atividades extracurriculares).

O produto nasce de um caso real (curso de Engenharia de Computação da UFG, matriz ENGCO-BI-2 de 2021.1) mas é projetado desde o início para múltiplos cursos e múltiplos usuários, com um usuário administrador que provisiona contas e cada estudante gerenciando apenas os próprios dados.

### 1.1 Objetivos do produto

O objetivo primário é dar visibilidade acionável sobre a integralização: percentual concluído por composição de carga horária, disciplinas desbloqueadas e recomendação ordenada por impacto. O objetivo secundário é ser um ambiente de planejamento — simular semestres futuros e montar grades sem risco de perder o estado real. O objetivo estrutural é servir de projeto de formação para o autor, com uma arquitetura que ensine autenticação, modelagem relacional e separação cliente/servidor implementando, e não apenas configurando.

### 1.2 Público-alvo

Estudantes de graduação da instituição, com um administrador (inicialmente o próprio autor) responsável por criar contas. Não há auto-cadastro aberto na v1: o acesso é por convite.

---

## 2. Escopo

### 2.1 Dentro do escopo (v1)

O sistema cobre: autenticação por convite com senha definida pelo próprio usuário; administração de contas por um papel admin; cálculo de status de disciplina a partir do grafo de requisitos e dos marcos de horas; somas de carga horária por composição com teto de exibição em 100% preservando o excedente; recomendação de disciplinas por destravamento transitivo; distinção persistida entre marcação oficial e simulada; cadastro manual de optativas fora da matriz e de componentes de Núcleo Livre, Atividades Complementares e registros extracurriculares; cenários de cronograma semanal com parser de código SIGAA, detecção de conflitos e pintura de atividades pessoais; múltiplos cursos por importação de matriz; tema claro/escuro por usuário; e exportação/importação de backup dos dados do próprio usuário.

### 2.2 Fora do escopo (v1)

Não estão previstos para a primeira versão: integração automática com o SIGAA (a carga de histórico é manual ou por seed); notificações por e-mail ou push; aplicativo móvel nativo; compartilhamento de cronogramas entre usuários; e importação automática do PDF de extrato (a transcrição da matriz é feita por seed curado).

### 2.3 Suposições e dependências

Assume-se que o usuário tem acesso ao próprio extrato do SIGAA para conferência, que a matriz do curso é razoavelmente estável entre semestres, e que a validação de equivalências de optativas fora da matriz é feita pela coordenação do curso — o sistema apenas registra, não decide equivalência. O ambiente depende de um servidor PostgreSQL e de um runtime Node.js compatível com as bibliotecas escolhidas.

---

## 3. Glossário de domínio

Integralização é o cumprimento total da carga horária exigida pelo curso, distribuída por composições. Composição é uma categoria de carga horária com mínimo próprio: Núcleo Comum (NC), Núcleo Específico Obrigatório (NEO), Núcleo Específico Optativo (OPT), Núcleo Livre (NL) e Atividades Complementares (AC). Marco (CH1/CH2/CH3) é um limiar de horas integralizadas que, uma vez atingido, funciona como pré-requisito de certas disciplinas. Pré-requisito é a disciplina (ou marco) que precisa estar concluída antes; co-requisito é a que pode ser cursada antes ou junto. Enrollment é o vínculo de um usuário a um curso. Código SIGAA de horário é a notação que combina dias, turno e ordens de aula (ex.: `56M23456`).

---

## 4. Perfis de usuário e papéis

O papel USER gerencia exclusivamente os próprios enrollments: marca status de disciplinas, cadastra e edita extras, cria e edita cenários de cronograma, altera o próprio tema e exporta/importa o próprio backup. Nunca enxerga dados de outros usuários. O papel ADMIN acumula tudo que o USER faz e, além disso, cria contas de usuário, reemite convites, remove contas e importa novas matrizes de curso. Toda decisão de autorização é validada no servidor, em cada requisição — a interface esconder um botão nunca é considerado controle de acesso.

---

## 5. Requisitos funcionais

Cada requisito referencia sua origem na concepção do produto.

| ID | Requisito | Origem |
| --- | --- | --- |
| RF-01 | O admin cria usuários informando nome, e-mail, papel e, opcionalmente, uma matrícula inicial em um curso, sem definir a senha. O sistema gera um token de convite de uso único com expiração e devolve o link ao admin. | "admin que pudesse criar usuários" |
| RF-02 | Ao abrir o link de convite, o próprio usuário define sua senha. O token é validado por hash e invalidado após o uso. | "que o próprio usuário crie sua senha" |
| RF-03 | Login por e-mail e senha, com sessão baseada em JWT de acesso curto e refresh token opaco rotativo em cookie httpOnly. O logout revoga o refresh. | "login, autenticação, cadastro e tudo o mais" |
| RF-04 | Recuperação de senha por token, reaproveitando o mecanismo de convite com finalidade distinta. | idem |
| RF-05 | Painel de progresso por enrollment com somas por composição (NC/NEO/OPT/NL/AC), total integralizado e estado dos marcos CH1/CH2/CH3. Valores acima do mínimo permanecem registrados e visíveis, mas barras e percentuais travam em 100% (ver RN-04). | "registrar e contabilizar porém travar nos 100%" |
| RF-06 | Marcação de disciplina por enrollment em dois estados persistidos: aprovada (oficial) e simulada (planejamento). A ausência de registro significa pendente. A interface distingue os estados e oferece restaurar a baseline oficial. | evolução da simulação do protótipo |
| RF-07 | Recomendação de disciplinas disponíveis ranqueadas pelo número de disciplinas que cada uma destrava transitivamente no grafo, com obrigatórias tendo precedência sobre optativas no desempate. | protótipo |
| RF-08 | Cadastro manual de optativas ausentes das tabelas da matriz, contabilizadas em Núcleo Específico Optativo, com aviso explícito de que a equivalência depende de validação da coordenação. | "adição manual de optativas que não estejam na tabela" |
| RF-09 | Cadastro de componentes de Núcleo Livre, Atividades Complementares e registros extracurriculares (estágio, ligas, iniciação científica), cada um com situação concluída ou planejada; itens planejados não somam nas barras. | "atividades extracurriculares poder cadastrar" |
| RF-10 | Cenários de cronograma por enrollment, com criar, duplicar, renomear e excluir. | protótipo |
| RF-11 | Disciplinas de cenário identificadas por código SIGAA, validado tanto no cliente quanto no servidor. A grade semanal detecta conflitos de horário e sinaliza divergência entre aulas por semana e a estimativa carga horária ÷ 16. | protótipo |
| RF-12 | Pintura de atividades pessoais nas células livres da grade, por categorias configuráveis, persistida por célula. | protótipo |
| RF-13 | Suporte a múltiplos cursos. Curso é entidade com matriz, composições e marcos próprios; um usuário pode ter vários enrollments; o admin importa novas matrizes por JSON no mesmo formato do seed. | "escalável, pretendo adicionar outros dois cursos" |
| RF-14 | Seed idempotente que popula o curso de Engenharia de Computação completo e a conta do usuário Higor com a baseline auditada do extrato. Contas criadas pelo fluxo normal nascem vazias. | "o meu populado, cru para os demais" |
| RF-15 | Tema claro ou escuro por usuário, persistido no servidor. | "modo claro" |
| RF-16 | Exportação e importação de backup em JSON dos dados do próprio usuário. | continuidade do protótipo |
| RF-17 | Cadastro público (auto-registro): qualquer pessoa cria a própria conta com nome, e-mail e senha, e se matricula num curso do catálogo. Desligável por instância (`ALLOW_REGISTRATION=false` volta ao modo somente-convite). A listagem de contas pelo admin (nome, e-mail, papel, cursos, reemissão de convite) integra o RF-01. | preparação open source: "cada pessoa deveria poder fazer cadastro" |
| RF-18 | Envio de e-mail para convite e redefinição de senha via SMTP configurável (Gmail/Resend/Brevo…). Sem SMTP, o sistema opera em modo manual: o link é registrado no log e devolvido ao admin para repasse. Falha de envio nunca bloqueia o fluxo. | "o convite não veio para o meu email" |
| RF-19 | Estado intermediário CURSANDO por disciplina, além de aprovada e simulada: não soma no progresso oficial, soma na projeção, sai das recomendações; um clique promove para aprovada quando o resultado sai. | "deveria ter um estado intermediário (cursando)" |
| RF-20 | Período letivo corrente e férias: o sistema sugere o período pelo calendário (mar–jul = .1, ago–dez = .2, jan/fev = férias) e exibe no topo; o usuário pode fixar o período real da sua matrícula (`currentTerm`), que prevalece sobre a sugestão. | "acompanhar e mostrar o período em que estou, ou se estou de férias" |
| RF-21 | Gestão administrativa ampliada: estatísticas da instância (usuários, convites pendentes, cursos, matrículas, atividade), alteração de papel (com guarda contra auto-rebaixamento), e matrícula/desmatrícula de usuários em cursos. | "mais algumas funções exclusivas do admin" |

---

## 6. Regras de negócio

As regras abaixo governam o comportamento do domínio e devem ser implementadas no servidor, independentemente da interface.

**RN-01 — Elegibilidade de disciplina.** Uma disciplina está *aprovada* se houver registro de status aprovado; *bloqueada* se algum pré-requisito (disciplina ou marco de horas) não estiver satisfeito; *cursável junto do co-requisito* se todos os pré-requisitos estiverem satisfeitos mas restar co-requisito pendente cujo próprio conjunto de pré-requisitos esteja satisfeito; e *disponível* nos demais casos. Um co-requisito pendente que ele mesmo esteja bloqueado rebaixa a disciplina para bloqueada.

**RN-02 — Pré-requisito por marco de horas.** Marcos CH1 (1.200h), CH2 (2.144h) e CH3 (2.400h) são satisfeitos quando o total de horas integralizadas atinge o limiar. Servem de pré-requisito para disciplinas específicas (por exemplo, o Estágio Supervisionado exige CH2).

**RN-03 — Composição de carga horária.** Cada disciplina aprovada soma sua carga horária à composição correspondente: optativas de grupo somam em OPT, disciplinas de Núcleo Comum em NC e demais obrigatórias em NEO. Componentes extras concluídos somam em OPT, NL ou AC conforme sua categoria; a categoria "somente registro" não soma.

**RN-04 — Teto de exibição e excedente.** O valor real de cada composição e do total é sempre preservado e armazenado. Barras de progresso e percentuais exibidos são limitados a 100%; o excedente é mostrado separadamente ("+X h além do mínimo") mas nunca infla o percentual. Esta regra atende ao pedido de "registrar e contabilizar porém travar nos 100%".

**RN-05 — Itens planejados não contabilizam.** Componentes extras com situação planejada e disciplinas em estado simulado não entram nas somas oficiais; entram apenas na projeção quando o usuário estiver no modo de simulação.

**RN-06 — Simulação reversível.** O estado simulado é claramente distinguível do oficial e pode ser descartado a qualquer momento, restaurando a baseline. O usuário nunca perde o estado real ao simular.

**RN-07 — Validação de código SIGAA.** Um código válido segue o padrão `dias + turno + ordens`, com dias de 2 (segunda) a 7 (sábado), turnos M/T/N e ordens de aula de 1 a 6, respeitando que o turno noturno vai até a ordem 5. Blocos múltiplos são separados por espaço. A validação ocorre no cliente (feedback imediato) e no servidor (fonte de verdade).

**RN-08 — Detecção de conflito.** Duas disciplinas de um mesmo cenário em conflito quando ocupam a mesma célula dia×ordem. O conflito é sinalizado, não impedido — o usuário pode manter o conflito enquanto decide.

**RN-09 — Isolamento por usuário.** Toda leitura ou escrita de enrollment, extra, cenário ou status é filtrada pelo usuário autenticado. Um usuário jamais acessa recurso de outro, mesmo conhecendo o identificador.

**RN-10 — Equivalência de optativa externa não é automática.** Optativas cadastradas fora da matriz são registradas e contabilizadas na projeção do usuário, mas o sistema deixa claro que a validade da equivalência depende de aprovação da coordenação.

---

## 7. Requisitos não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 (segurança) | Senhas armazenadas com argon2; tokens de convite e refresh armazenados apenas como hash, nunca em texto puro. |
| RNF-02 (transporte) | HTTPS em produção com TLS terminado no proxy reverso; cookies com httpOnly, secure e sameSite; cabeçalhos de segurança via helmet; CORS restrito à origem do frontend. |
| RNF-03 (abuso) | Rate limiting global por IP e limite mais estrito nas rotas de autenticação, para mitigar força bruta e enumeração. |
| RNF-04 (robustez) | Validação de todo payload de entrada no servidor com zod; respostas de erro não expõem stack trace nem detalhes internos. |
| RNF-05 (autorização) | Autorização por posse em toda rota de recurso do usuário (ver RN-09). |
| RNF-06 (desempenho) | Índices nos campos de filtro frequente (o schema já os contempla); o progresso de um enrollment é calculado em uma única leitura agregada; o cálculo de grafo ocorre em memória (a matriz tem cerca de 120 disciplinas, custo desprezível). |
| RNF-07 (escalabilidade) | API sem estado de sessão em memória (sessão via token), permitindo réplicas atrás de um balanceador; dados centralizados em PostgreSQL. |
| RNF-08 (privacidade/LGPD) | Coleta mínima de dados pessoais (nome e e-mail); exclusão de conta remove os dados vinculados em cascata; senhas e tokens nunca aparecem em logs. |
| RNF-09 (manutenibilidade) | Backend em módulos por domínio; lógica de domínio pura (parser SIGAA, grafo, somas) isolada e testável; um mesmo algoritmo que roda no cliente por conveniência é reexecutado no servidor como fonte de verdade. |
| RNF-10 (observabilidade) | Logs estruturados de requisição com correlação, sem dados sensíveis; erros de validação registrados de forma agregada. |
| RNF-11 (portabilidade) | Ambiente reprodutível via Docker Compose; variáveis de ambiente validadas na inicialização, com falha imediata se ausentes ou inválidas. |

---

## 8. Arquitetura

``
[Browser: React + Vite + TypeScript]
        │  HTTPS
        ▼
[Proxy reverso — termina TLS, aplica cabeçalhos]
        │
        ▼
[API Fastify + TypeScript]  ── Prisma ORM ──▶  [PostgreSQL]
        │
   JWT de acesso (memória do cliente) + refresh opaco (cookie httpOnly)
``

O backend é um monólito modular: um único processo Fastify que agrupa plugins de infraestrutura (segurança, Prisma, autenticação) e módulos de domínio (auth, users, courses, progress, extras, schedules), cada um com suas rotas e serviços. A escolha por monólito modular — em vez de microsserviços — é deliberada para um projeto de uma pessoa: menor custo operacional, deploy único, e ainda assim fronteiras internas claras que permitem extrair um módulo no futuro se necessário. O frontend é uma SPA React servida estaticamente, consumindo a API por um cliente HTTP fino com cache via TanStack Query.

### 8.1 Decisões de arquitetura registradas

A modelagem de composições e marcos como linhas de tabela (e não colunas fixas) é o que viabiliza cursos com estruturas diferentes sem alterar o schema — requisito direto do suporte a múltiplos cursos. A sessão via token (em vez de sessão em memória do servidor) mantém a API sem estado e pronta para replicação. A lógica de domínio vive em módulos puros reaproveitáveis entre cliente e servidor, com o servidor sempre como fonte de verdade.

---

## 9. Stack tecnológica

Backend: Node.js com TypeScript, framework Fastify, ORM Prisma, banco PostgreSQL, hashing argon2, validação zod, e os plugins oficiais `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/jwt` e `@fastify/cookie`. Frontend: React com Vite e TypeScript, TanStack Query para dados assíncronos, React Router para rotas e Zustand para estado local leve. Ambiente: Docker Compose.

Observação sobre versões: as versões exatas devem ser conferidas na documentação/npm de cada pacote no momento da instalação, pois APIs de plugins mudam entre versões maiores. Em particular, o ecossistema TypeScript está em transição da série 6.x para a 7.x (compilador reescrito em Go); código que compila limpo na 6.x deve compilar identicamente na 7.x, mas convém validar. Não fixe números de versão sem verificar.

Alternativa avaliada: usar Supabase (PostgreSQL gerenciado, autenticação pronta e row-level security) reduz significativamente o código de backend, ao custo de aprender menos sobre autenticação e autorização. Para o objetivo de formação declarado, a implementação própria é a recomendada; para velocidade de entrega, a alternativa é válida.

---

## 10. Modelo de dados

O schema Prisma completo está em `backend/prisma/schema.prisma`. As entidades principais são: **User** (papel, tema, hash de senha anulável até o convite ser aceito), **InviteToken** e **RefreshToken** (armazenam apenas hash, com expiração e marcação de uso/revogação), **Course**, **CompositionRequirement** (as composições NC/NEO/OPT/NL/AC parametrizadas por curso), **Milestone** (CH1/CH2/CH3), **Subject** (disciplina com número de sequência da matriz, núcleo e grupo de optativa), **Requisite** (pré/co apontando para outra disciplina ou para uma chave de marco), **Enrollment** (vínculo usuário×curso), **SubjectStatus** (aprovada ou simulada), **ExtraComponent** (optativa externa, NL, AC ou registro), **Scenario**, **ScenarioDiscipline** e **ScenarioPaint**. As chaves compostas garantem unicidade (uma disciplina por sequência dentro de um curso; um status por disciplina dentro de um enrollment; uma pintura por célula dentro de um cenário), e há índices nos campos de filtro frequente.

---

## 11. Contrato de API

| Método e rota | Papel | Requisito |
| --- | --- | --- |
| `POST /auth/invite/accept` | público | RF-02 |
| `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` | público/sessão | RF-03 |
| `POST /auth/password/forgot` | público | RF-04 |
| `GET /users` · `POST /users` · `PATCH /users/:id` · `POST /users/:id/invite` · `POST/DELETE /users/:id/enrollments[/:id]` · `DELETE /users/:id` | ADMIN | RF-01, RF-21 |
| `POST /auth/register` | público (se habilitado) | RF-17 |
| `POST /me/enrollments` · `PATCH /me/enrollments/:id` | autenticado | RF-17, RF-20 |
| `POST /me/password` | autenticado | segurança da conta |
| `GET /admin/stats` | ADMIN | RF-21 |
| `GET /courses` · `GET /courses/:slug` | autenticado | RF-13 |
| `POST /courses/import` | ADMIN | RF-13 |
| `GET /me/enrollments` | autenticado | RF-05 |
| `GET /me/enrollments/:id/progress` | autenticado | RF-05 |
| `GET /me/enrollments/:id/recommendations` | autenticado | RF-07 |
| `PUT /me/enrollments/:id/subjects/:subjectId` | autenticado | RF-06 |
| `GET/POST /me/enrollments/:id/extras` · `PATCH/DELETE /me/extras/:id` | autenticado | RF-08, RF-09 |
| CRUD `/me/enrollments/:id/scenarios` · `/me/scenarios/:sid/disciplines` · `PUT /me/scenarios/:sid/paint` | autenticado | RF-10, RF-11, RF-12 |
| `PATCH /me/settings` (tema) | autenticado | RF-15 |
| `GET /me/export` · `POST /me/import` | autenticado | RF-16 |

Todas as respostas de erro seguem um formato uniforme, sem vazar detalhes internos.

---

## 12. Fluxos de autenticação

**Convite.** O admin cria o usuário; a API gera um token aleatório com `crypto`, armazena apenas o hash com expiração (sugerida de 72 horas) e devolve ao admin o link `/convite/<token>` para repasse. O usuário abre o link e define a senha (hash argon2); o token é marcado como usado e não pode ser reutilizado.

**Login e sessão.** Na autenticação, a senha é verificada com argon2. Emite-se um JWT de acesso de vida curta (sugerido de 15 minutos, com as claims de identificação e papel) e um refresh token opaco de vida longa (sugerido de 14 dias) entregue em cookie httpOnly, secure e sameSite. A cada uso do refresh, ele é rotacionado; a detecção de reuso de um refresh já rotacionado revoga toda a família de tokens daquele usuário, mitigando roubo de token. O reset de senha reaproveita o fluxo de convite com finalidade distinta.

---

## 13. Segurança — consolidação

A regra de ouro do projeto: o cliente é conveniência, o servidor é a verdade. Todo cálculo que concede algo — posse de recurso, papel do usuário, validade de código SIGAA persistido, elegibilidade de disciplina — é reexecutado no servidor. Ver RNF-01 a RNF-05 e RNF-08. Nenhum segredo (JWT_SECRET, senha do seed) deve ser versionado; o `.env.example` traz apenas instruções de como gerar os valores.

---

## 14. Frontend — mapa de componentes

Páginas: Login, Invite, Overview, Subjects, Extras, Schedule, Settings e Admin. Componentes por domínio: layout (AppHeader, NavTabs, ThemeToggle), overview (IntegralizationBus, DonutProgress, CompositionCards, RecoGrid), courses (CourseFilters, CourseTable, CourseRow, SimBar), extras (ExtraForm, ExtraList), schedule (ScenarioTabs, DisciplineForm, DisciplineList, ScheduleGrid, PaintPalette), admin (UserAdmin, CourseImport) e primitivos de UI (Button, Card, Chip). A lógica de domínio pura reside em `src/lib` (`sigaa.ts`, `graph.ts`, `sums.ts`), portada do protótipo e coberta por testes. O protótipo HTML permanece como referência visual e comportamental de cada componente.

---

## 15. Riscos e incertezas declaradas

A regra de contabilização de Núcleo Livre excedente no total integralizado do SIGAA não está confirmada; o sistema registra o valor real e trava a exibição em 100%, mas o número oficial deve ser conferido no extrato de cada aluno. A equivalência de optativas fora da matriz depende da coordenação do curso — o sistema apenas registra. As versões de bibliotecas evoluem: os trechos de código usam APIs estáveis e amplamente documentadas, mas versões maiores podem alterar assinaturas de plugins; confira a documentação oficial ao instalar e não fixe versões sem verificação. A baseline do perfil Higor reflete o extrato no fechamento de um período específico; marcações dependentes de notas ainda não publicadas (por exemplo, disciplinas em curso) devem ser reconferidas no SIGAA quando as notas saírem.

---

## 16. Roadmap

**M1 — Fundação.** Subir o PostgreSQL, migrar o schema, rodar o seed e validar o health-check. **M2 — Autenticação.** RF-01 a RF-04 no backend e guardas de rota no frontend. **M3 — Progresso.** RF-05 a RF-07, portando a interface do protótipo. **M4 — Extras e Cronograma.** RF-08 a RF-12. **M5 — Operação.** Dockerfiles de API e web, proxy com TLS, backups do banco e rate limit por rota (RNF-03). **M6 — Múltiplos cursos.** RF-13 com a importação das próximas matrizes.

---

## 17. Critérios de aceite (amostra)

Um usuário recém-convidado consegue definir a senha e entrar, e vê o painel vazio. O admin consegue criar uma conta e obter um link de convite funcional. O perfil Higor, após o seed, exibe o total integralizado correto e as composições com o excedente sinalizado sem ultrapassar 100%. Marcar uma disciplina como simulada não altera as somas oficiais e pode ser revertido. Um código SIGAA inválido é rejeitado com mensagem clara tanto no cliente quanto no servidor. Um usuário não consegue, por manipulação de identificador, ler o enrollment de outro (retorna 403/404, nunca os dados).
