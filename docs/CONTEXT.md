# Contexto — IADDRAM Local

Atualizado em 2026-10-22.

## Objetivo e estado

Memória persistente e cifrada no próprio computador, compartilhada entre agentes
por MCP stdio. Prévia 0.1.0 separada do Server em projeto independente.
Publicado em https://github.com/vermoraes133/iaddram-local (2026-10-22, prévia 0.1.0). NPM adiado até validar Windows/Linux.

## Componentes

- `apps/local-cli`: CLI, onboarding, status, backup e quatro ferramentas MCP.
- `packages/memory-kernel`: escrita, recall textual, cápsulas e criptografia.
- `packages/storage-pglite`: persistência embutida e locks por operação.
- `packages/contracts`: schemas e validações, copiados para este workspace.
- `scripts/package.mjs`: bundle instalável sem depender do projeto Server.

## Operação e desenvolvimento

Use Node.js 22/24 e `corepack pnpm` para respeitar a versão fixada.
`corepack pnpm install --frozen-lockfile`, `corepack pnpm check`,
`corepack pnpm package`. O README explica init, configuração MCP, onboarding e backup.
Dados reais ficam fora do Git (diretório padrão de execução: `~/.iaddram`).
A separação de fontes não move dados nem altera as configurações dos clientes.

## Limites

Busca textual sem embeddings, sem GUI, sincronização Server, RBAC multiusuário ou
editor humano de briefing. Validar clientes reais e cofres Windows/Linux antes de stable.
Confira `docs/adr/0001-projeto-independente.md` e o handoff desta separação.
