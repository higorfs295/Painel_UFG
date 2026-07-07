# Painel Acadêmico

Aplicação web multiusuário para acompanhamento de integralização curricular, planejamento de disciplinas e montagem de cronogramas semanais a partir de códigos de horário do SIGAA. Evolui um protótipo de página única para um sistema com autenticação, papéis (administrador e usuário), múltiplos cursos e persistência em banco.

> Leia a **[ESPECIFICACAO.md](./ESPECIFICACAO.md)** antes de contribuir — ela define escopo, requisitos funcionais e não-funcionais, regras de negócio e o contrato de API que os módulos implementam.

---

## O que o sistema faz

A partir da matriz oficial de um curso e do histórico do aluno, o painel calcula o status de cada disciplina no grafo de pré e co-requisitos (aprovada, disponível, cursável junto do co-requisito, ou bloqueada), soma a carga horária por composição (Núcleo Comum, Específico Obrigatório, Optativo, Livre e Atividades Complementares) com teto de exibição em 100% preservando o excedente, e recomenda o que cursar em seguida ordenando pelas disciplinas que cada opção destrava. Permite ainda marcar semestres simulados sem perder o estado real, cadastrar componentes fora da matriz e atividades extracurriculares, e montar cenários de cronograma com detecção de conflitos.

É multiusuário: um administrador cria contas e cada estudante define a própria senha por convite, enxergando apenas os próprios dados. A conta de referência (Higor) nasce populada por seed; contas criadas pelo fluxo normal nascem vazias.

---

## Arquitetura em uma imagem

``
[Browser: React + Vite + TS] ──HTTPS──▶ [Proxy/TLS] ──▶ [API Fastify + TS] ──Prisma──▶ [PostgreSQL]
``

Monólito modular no backend (plugins de infraestrutura + módulos de domínio), SPA no frontend, sessão via JWT de acesso curto + refresh opaco em cookie httpOnly. Detalhes e decisões de arquitetura na especificação, §8.

---

## Estrutura do repositório

``
.
├── backend/            API Node.js + TypeScript (Fastify + Prisma + PostgreSQL)
│   ├── prisma/         schema e migrações
│   └── src/
│       ├── plugins/    segurança, prisma, auth (infraestrutura)
│       ├── modules/    auth, users, courses, progress, extras, schedules (domínio)
│       └── seed/       matriz + perfil de referência e script de seed
├── frontend/           SPA React + Vite + TypeScript
│   └── src/
│       ├── lib/        lógica de domínio pura (parser SIGAA, grafo, somas)
│       ├── components/ componentes por domínio
│       └── pages/      páginas roteadas
├── docker-compose.yml  PostgreSQL local
└── ESPECIFICACAO.md    documento de referência
``

---

## Requisitos de ambiente

Node.js (versão LTS compatível com as dependências — confira os `engines` nos `package.json`), Docker e Docker Compose, e um cliente PostgreSQL para inspeção (opcional). As versões exatas das bibliotecas estão nos `package.json` e no lockfile de cada pacote; confira a documentação oficial antes de atualizar versões maiores.

---

## Começando (ambiente de desenvolvimento)

*1. Banco de dados

```bash
docker compose up -d db
```

*2. Backend

```bash
cd backend
cp .env.example .env          # edite o .env: gere um JWT_SECRET real (instruções no arquivo)
npm install
npx prisma migrate dev --name init
SEED_ADMIN_PASSWORD='defina-uma-senha-forte' npm run seed
npm run dev                   # sobe a API em http://localhost:3333
```

Verifique a saúde da API: `curl http://localhost:3333/health` deve responder `{"ok":true}`.

*3. Frontend

```bash
cd ../frontend
npm install
npm run dev                   # sobe a interface em http://localhost:5173
```

> **Importante sobre segredos:** nunca versione o arquivo `.env` real. O `.env.example` traz apenas instruções de como gerar `JWT_SECRET` e nunca um segredo pronto. A senha do admin do seed é passada por variável de ambiente no momento da execução, não fica no repositório.

---

## Estado atual do código

A fundação está montada: schema de dados completo, plugins de segurança e autenticação configurados, contratos de rota definidos com validação de entrada, e a lógica de domínio pura (parser SIGAA, grafo de requisitos, somas com teto de 100%) implementada e testável no frontend. Os handlers de cada módulo do backend seguem marcados como pendentes (respondendo `501`), referenciando o requisito correspondente (RF-xx) na especificação — é o trabalho de implementação previsto no roadmap. Consulte a especificação (§16) para a ordem sugerida.

---

## Documentação por pacote

Cada pacote tem seu próprio README com detalhes específicos: **[backend/README.md](./backend/README.md)** cobre módulos, banco, seed e segurança do servidor; **[frontend/README.md](./frontend/README.md)** cobre estrutura de componentes, a camada de dados e a lógica de domínio compartilhada.

---

## Convenções

Commits pequenos e descritivos. Toda regra de negócio validada no servidor, mesmo quando já validada no cliente. Nenhum segredo em código ou histórico. Alterações de contrato de API refletidas na especificação (§11) no mesmo commit.

---

## Licença

Defina a licença do projeto (por exemplo, adicionando um arquivo `LICENSE`). Enquanto não houver licença explícita, considere o código como de uso restrito do autor.
