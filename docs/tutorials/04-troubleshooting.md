# 04 — Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `pnpm` com versão errada | pnpm global diferente do fixado | Use `corepack pnpm` |
| `typecheck` acusa pacote interno sem tipos | declarations ainda não compiladas | `corepack pnpm build` antes (o `check` já faz) |
| Chave ausente no cofre | cofre nativo bloqueado ou outro usuário | Rode `iaddram doctor`; ausência de chave nunca gera rotação |
| Dois clientes travando | lock por operação ocupado | Aguarde; o PGlite fecha a cada operação |
