# Política de segurança

## Reportando uma vulnerabilidade

**Não abra uma issue pública** para falhas de segurança.

Use um destes canais:

1. **GitHub Security Advisories** (preferido) — aba *Security* → *Report a vulnerability*.
   O relato fica privado até a correção.
2. **E-mail** — `<SEU E-MAIL DE CONTATO>`, com `[SECURITY]` no assunto.

Inclua, se possível: passos para reproduzir, impacto que você enxerga, versão/commit afetado e
qualquer prova de conceito.

### O que esperar

Este é um projeto mantido por uma pessoa, no tempo livre. Não há SLA. O compromisso realista é:

- **Confirmação de recebimento** em até 7 dias.
- **Avaliação inicial** (é vulnerabilidade? qual severidade?) em até 30 dias.
- Crédito no changelog quando a correção sair, se você quiser.

Por favor, dê um tempo razoável para a correção antes de divulgar publicamente.

## Escopo

Em escopo: o código deste repositório (backend, frontend, configuração de deploy e templates de
infraestrutura).

Fora de escopo: vulnerabilidades em dependências de terceiros (reporte ao projeto de origem);
falhas que exigem acesso físico à máquina ou credenciais de administrador já comprometidas;
ausência de recursos de hardening que o projeto nunca prometeu ter.

## Instâncias de terceiros

Cada pessoa que sobe a própria instância é responsável por ela. Se você encontrou um problema em
uma instância pública específica, procure quem a opera — não os mantenedores do projeto.

## Checklist para quem opera uma instância

`docs/SEGURANCA.md` tem o modelo de ameaças completo. O mínimo antes de expor à internet:

- [ ] `JWT_SECRET` com 32+ caracteres, gerado aleatoriamente e **nunca** versionado
- [ ] `FIELD_ENCRYPTION_KEY` definida (cifra a matrícula em repouso) e guardada em cofre,
      **separada** do backup do banco
- [ ] `COOKIE_SAMESITE=none` apenas em deploy cross-site, e sempre com HTTPS nos dois lados
- [ ] `CORS_ORIGIN` restrito às origens reais — nunca `*`
- [ ] `DEV_TOOLS` desligada (o gerador de dados fictícios recusa em produção mesmo assim, mas a
      flag não deveria existir lá)
- [ ] `DOCS_ENABLED=false` (a OpenAPI já desliga sozinha em produção; não confie só nisso)
- [ ] `ALLOW_REGISTRATION` de acordo com a sua intenção — `true` significa que qualquer pessoa
      na internet pode criar conta
- [ ] Backup do banco agendado e **testado** (restaurar, não só gerar)
