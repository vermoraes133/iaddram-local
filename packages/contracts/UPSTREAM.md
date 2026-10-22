# Origem de `@iaddram/contracts`

Cópia versionada (decisão do owner em 2026-10-18, ADR-0002). Não é submódulo
nem pacote publicado: o Server é privado e esta edição é Apache-2.0.

| Campo | Valor |
|---|---|
| Repositório de origem | IADDRAM Server (repositório privado) |
| Caminho de origem | `packages/contracts/src/` |
| Commit de origem | `5b2b2465a95138935caad286a656fddb88ffeadb` |
| Versão de origem | `0.9.0` |
| Copiado em | 2026-10-18 |
| Diferenças locais | `package.json`: `license: Apache-2.0`; nenhuma outra |

O Local usa sete símbolos: `assessMemoryQuality`, `buildContextEnvelope`,
`ContextMemory`, `idempotencyKeySchema`, `memoryWriteSchema`,
`recallRequestSchema` e `scanForSecrets` (todos em `packages/memory-kernel`).
O restante veio junto para preservar os testes; enxugar é trabalho futuro.

## Atualizar a cópia

1. Com um checkout do Server, rode
   `node scripts/check-contracts-upstream.mjs <caminho-do-IADDRAM> [ref]`.
   O script lista arquivos divergentes e commits do Server em
   `packages/contracts` depois do commit de origem.
2. Traga só o que o Local precisa, rode `corepack pnpm check` e atualize a tabela
   acima no mesmo commit.

Mudança de formato de cápsula, criptografia ou backup nunca entra por esta cópia
sem teste de compatibilidade (ver `AGENTS.md`).

Comentários como `ADR-0019` e `ADR-0020` dentro de `src/` citam ADRs do Server,
não deste repositório.
