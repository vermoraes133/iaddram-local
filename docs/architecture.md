# Arquitetura — IADDRAM Local

## Contexto (C4 nível 1)

Uma pessoa usa agentes (Claude, Codex e outros clientes MCP) no próprio computador.
Cada cliente inicia `iaddram mcp --project <uuid> --agent <nome>` por stdio. Não há
rede: as memórias ficam num diretório local (padrão `~/.iaddram`), cifradas, e a
chave fica no cofre nativo do sistema.

## Contêineres (C4 nível 2)

| Peça | Papel |
|---|---|
| `apps/local-cli` | CLI (`init`, `doctor`, `project`, `config`, `onboard`, `status`, backup) e servidor MCP stdio |
| `packages/memory-kernel` | Regras de escrita e recall, cápsulas, envelope cifrado e HMAC de busca |
| `packages/storage-pglite` | `MemoryStore` sobre PGlite 0.5.8, com lock por operação |
| `packages/contracts` | Schemas e validações copiados do Server (ADR-0002) |
| `scripts/package.mjs` | Bundle esbuild instalável, com NOTICE das dependências |

Detalhes de fronteira de confiança, criptografia e limites: ADR-0017 e `README.md`.
