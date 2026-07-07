# Painel Acadêmico Multiusuário — Especificação v1.0

Documento de referência do projeto que evolui o protótipo (artefato HTML de usuário único) para uma aplicação web real com autenticação, papéis e múltiplos cursos. Cada requisito referencia os pedidos feitos durante a concepção. Onde há incerteza factual, ela está sinalizada explicitamente na Seção 13.

## 1. Visão e escopo

O sistema acompanha a integralização de matrizes curriculares universitárias (inicialmente a ENGCO-BI-2 2021.1 da UFG), calcula o status de cada disciplina a partir do grafo de pré e co-requisitos e dos marcos de horas (CH1/CH2/CH3), recomenda disciplinas pelo impacto de destravamento, registra componentes fora da matriz (optativas equivalentes, Núcleo Livre, Atividades Complementares e registros como estágio, ligas e IC) e monta cenários de cronograma semanal a partir de códigos de horário SIGAA. É multiusuário: um administrador cria contas, cada pessoa define a própria senha e enxerga somente os próprios dados; a conta do Higor nasce populada com a baseline auditada do extrato, via seed.

Fora do escopo da v1: integração automática com o SIGAA (a leitura do extrato é manual ou por seed), notificações e aplicativo móvel nativo.

## 2. Perfis e papéis

O papel ADMIN administra usuários (criar, convidar, remover, reemitir convite) e importa novas matrizes de curso, além de ter tudo que um USER tem. O papel USER gerencia apenas os próprios vínculos (enrollments): status de disciplinas, extras, cenários, tema e backup. A autorização é verificada no servidor em toda rota — nunca apenas na interface.

## 3. Requisitos funcionais

| ID | Requisito | Origem |
| --- | --- | --- |
| RF-01 | Admin cria usuários (nome, e-mail, papel, matrícula inicial opcional) sem definir senha; o sistema gera link de convite com token de uso único e expiração. | "admin que pudesse criar usuários" |
| RF-02 | O próprio usuário define sua senha ao abrir o link de convite (token validado por hash, uso único). | "que o próprio usuário crie sua senha" |
| RF-03 | Login com e-mail e senha; sessão via JWT de acesso curto + refresh token opaco rotativo em cookie httpOnly; logout revoga o refresh. | "login, autenticação, cadastro e tudo o mais" |
| RF-04 | Recuperação de senha por token, com o mesmo mecanismo do convite. | idem |
| RF-05 | Painel de progresso por enrollment: somas por composição (NC/NEO/OPT/NL/AC), total integralizado e marcos CH1..CH3; valores acima do mínimo continuam registrados e exibidos, mas barras e percentuais travam em 100%. | "registrar e contabilizar porém travar nos 100%" |
| RF-06 | Marcação de disciplina com dois estados persistidos: APPROVED (oficial) e SIMULATED (planejamento); ausência de registro = pendente. A interface distingue visualmente e oferece "restaurar oficial". | evolução da simulação do protótipo |
| RF-07 | Recomendações: disciplinas disponíveis ranqueadas pelo número de disciplinas (obrigatórias primeiro) que destravam transitivamente no grafo. | protótipo |
| RF-08 | Cadastro manual de optativas fora das tabelas da matriz, contabilizadas em NE Optativo, com aviso de que a equivalência depende de validação da coordenação. | "adição manual de optativas que não estejam na tabela" |
| RF-09 | Cadastro de componentes de Núcleo Livre, Atividades Complementares e registros extracurriculares (estágio, ligas, IC), com situação concluída/planejada; planejados não somam. | "atividades extracurriculares poder cadastrar" |
| RF-10 | Cenários de cronograma por enrollment: criar, duplicar, renomear, excluir. | protótipo |
| RF-11 | Disciplinas de cenário com código SIGAA validado no cliente e no servidor; grade semanal com detecção de conflitos e verificação aulas/semana ≈ CH/16. | protótipo |
| RF-12 | Pintura de atividades pessoais na grade (categorias), persistida por célula. | protótipo |
| RF-13 | Múltiplos cursos: curso é entidade com matriz, composições e marcos próprios; um usuário pode ter vários enrollments; admin importa novas matrizes por JSON (mesmo formato do seed). | "escalável, pretendo adicionar outros dois cursos" |
| RF-14 | Seed idempotente popula o curso EngComp completo e a conta do Higor com a baseline auditada (23 aprovadas, 6 componentes NL, 219h de AC, registros); novas contas nascem vazias. | "o meu populado, cru para os demais" |
| RF-15 | Tema claro/escuro por usuário, persistido. | "modo claro" |
| RF-16 | Exportar/importar backup JSON dos dados do próprio usuário. | continuidade do protótipo |

## 4. Requisitos não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Senhas com argon2; tokens de convite e refresh armazenados apenas como hash. |
| RNF-02 | HTTPS em produção (TLS no proxy reverso); cookies httpOnly + secure + sameSite; cabeçalhos de segurança (helmet); CORS restrito à origem do frontend. |
| RNF-03 | Rate limiting global por IP e mais agressivo nas rotas de autenticação (mitigação de força bruta). |
| RNF-04 | Validação de todo payload no servidor com zod; erros não vazam stack trace. |
| RNF-05 | Autorização por posse: toda consulta a enrollment/cenário/extra filtra pelo usuário autenticado. |
| RNF-06 | Desempenho: índices nos campos consultados (o schema já contempla); progresso calculado em uma leitura por enrollment; grafo em memória (matrizes têm ~10² disciplinas — custo trivial). |
| RNF-07 | Escalabilidade: API sem estado (sessão via token), pronta para réplicas atrás de proxy; dados em PostgreSQL. |
| RNF-08 | LGPD: coletar o mínimo (nome, e-mail); exclusão de conta com cascade; não registrar senhas ou tokens em logs. |

## 5. Arquitetura e stack

``
[Browser: React + Vite + TS] --HTTPS--> [Proxy reverso (TLS)] --> [API Fastify + TS]
        |                                                              |
  TanStack Query (cache)                                          Prisma ORM
        |                                                              |
  JWT em memória + refresh em cookie httpOnly                   [PostgreSQL 16]
``

Stack recomendada: monólito modular com Node.js + TypeScript + Fastify + Prisma + PostgreSQL no backend; React + Vite + TypeScript + TanStack Query + React Router + Zustand no frontend; Docker Compose para o ambiente. Alternativa que corta boa parte do backend: Supabase (Postgres gerenciado + autenticação pronta + row-level security) com o mesmo frontend — o trade-off é aprender implementando (recomendado como projeto de formação) versus velocidade de entrega.

## 6. Modelo de dados

O schema Prisma completo está em `backend/prisma/schema.prisma`. Entidades: User (papel e hash de senha anulável até o convite ser aceito), InviteToken e RefreshToken (somente hash), Course, CompositionRequirement (composições flexíveis por curso), Milestone (CH1..CH3), Subject (disciplina com o número de sequência da matriz), Requisite (PRE/CO apontando para disciplina ou para uma milestoneKey), Enrollment (usuário × curso), SubjectStatus (APPROVED/SIMULATED), ExtraComponent (OPT/NL/AC/NONE), Scenario, ScenarioDiscipline e ScenarioPaint. Modelar composições e marcos como linhas — e não colunas fixas — é o que permite cursos com estruturas diferentes (RF-13).

## 7. Contrato de API (resumo)

| Método e rota | Papel | Função |
| --- | --- | --- |
| POST /auth/login · /auth/refresh · /auth/logout · /auth/password/forgot · /auth/invite/accept | público | RF-02/03/04 |
| GET/POST /users · POST /users/:id/invite · DELETE /users/:id | ADMIN | RF-01 |
| GET /courses · GET /courses/:slug · POST /courses/import | autenticado / ADMIN | RF-13 |
| GET /me/enrollments · GET /me/enrollments/:id/progress · GET /me/enrollments/:id/recommendations | autenticado | RF-05/07 |
| PUT /me/enrollments/:id/subjects/:subjectId | autenticado | RF-06 |
| GET/POST /me/enrollments/:id/extras · PATCH/DELETE /me/extras/:id | autenticado | RF-08/09 |
| CRUD /me/enrollments/:id/scenarios · /me/scenarios/:sid/disciplines · PUT /me/scenarios/:sid/paint | autenticado | RF-10/11/12 |

## 8. Fluxos de autenticação

Convite: o admin cria o usuário; a API gera um token aleatório (crypto), grava somente o hash com expiração de 72h e devolve o link `/convite/<token>` para o admin repassar; o usuário abre o link, define a senha (argon2) e o token é marcado como usado. Login: verificação argon2, emissão de JWT de acesso (~15 min, claims sub e role) e refresh opaco (~14 dias) em cookie httpOnly com rotação a cada uso; reuso de um refresh já rotacionado revoga a família de tokens. O reset de senha reaproveita o fluxo de convite com purpose distinto.

## 9. Segurança (consolidação)

Ver RNF-01..05 e RNF-08. Regra de ouro do projeto: o cliente é apenas conveniência — todo cálculo que concede algo (posse de recurso, papel, validação de código SIGAA persistido) reexecuta no servidor.

## 10. Frontend — mapa de componentes

Páginas: Login, Invite, Overview, Subjects, Extras, Schedule, Settings e Admin. Componentes por domínio (stubs já criados em `src/components`): layout (AppHeader, NavTabs, ThemeToggle), overview (IntegralizationBus, DonutProgress, CompositionCards, RecoGrid), courses (CourseFilters, CourseTable, CourseRow, SimBar), extras (ExtraForm, ExtraList), schedule (ScenarioTabs, DisciplineForm, DisciplineList, ScheduleGrid, PaintPalette), admin (UserAdmin, CourseImport) e ui (Button, Card, Chip). A lógica de domínio pura já está portada e testada em `src/lib` (sigaa.ts, graph.ts, sums.ts); o protótipo HTML permanece como referência visual e comportamental de cada componente.

## 11. Seeds e migração do protótipo

`matriz-engcomp-2021.json` contém as 120 disciplinas com requisitos, composições e marcos (transcritos do PDF oficial da matriz). `perfil-higor.json` contém a baseline auditada do extrato: 23 aprovadas (incluindo Engenharia Econômica, confirmada pelo usuário), 6 componentes de Núcleo Livre, 219h de Atividades Complementares e registros de estágio/IC. Quem usou o protótipo pode ainda exportar o JSON pelo próprio artefato e importar via RF-16.

## 12. Roadmap sugerido

M1 Fundação: subir o Postgres, migrar o schema, rodar o seed e o health-check (pronto no esqueleto). M2 Autenticação: RF-01..04 e guardas de rota no frontend. M3 Progresso: RF-05..07, portando a UI do protótipo. M4 Extras e Cronograma: RF-08..12. M5 Operação: Dockerfiles de api/web, proxy com TLS, backups do banco e RNF-03 por rota. M6 Multi-curso: RF-13 com a importação das duas próximas matrizes.

## 13. Riscos e incertezas declaradas

A regra de contabilização de Núcleo Livre excedente no total integralizado do SIGAA não está confirmada — o sistema registra o valor real e trava a exibição em 100%, mas o número oficial deve ser conferido no extrato. A equivalência de optativas fora da matriz (RF-08) depende de validação da coordenação do curso; o sistema apenas registra. Sobre versões e APIs de bibliotecas: os trechos de código usam APIs estáveis e amplamente documentadas (Fastify e plugins oficiais, Prisma, argon2, zod), mas versões maiores podem mudar assinaturas — confira a documentação oficial ao instalar; por isso os package.json não fixam versões que eu não posso verificar hoje. A nota final de Engenharia Econômica e a conclusão de GSI/IoT foram marcadas conforme confirmação do usuário e seguem pendentes de publicação no SIGAA.
