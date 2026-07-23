## O que muda

## Por quê

<!-- Referencie o RF ou a issue quando houver. -->

## Como foi verificado

<!-- Comandos rodados, testes novos, prints se for UI. -->

## Checklist

- [ ] `npm run typecheck` limpo nos dois lados (`backend/` e `web/`)
- [ ] Testes das camadas afetadas passando, e novos testes para o novo comportamento
- [ ] Espelhos sincronizados se mexi em `domain/{graph,sigaa,sums}.ts` → `web/src/lib/`
- [ ] Docs atualizados: `API.md` / `MODULOS.md` / `DOMINIO.md` / `ESPECIFICACAO.md` conforme o caso
- [ ] UI verificada em tema escuro **e** claro, desktop **e** ~375px, navegando por teclado
- [ ] Nenhum segredo ou valor local commitado (`.env` fica fora; documente em `.env.example`)
