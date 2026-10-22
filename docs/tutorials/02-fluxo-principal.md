# 02 — Fluxo principal

1. `iaddram onboard --path <projeto>` grava `.iaddram-local.json` e as instruções do agente.
2. Cada cliente MCP abre `iaddram mcp --project <uuid> --agent <nome>`.
3. O agente recupera a cápsula no início, salva checkpoints durante o trabalho e no handoff.
4. `iaddram status --path <projeto>` mostra se o projeto está adotado e tem cápsula.

Detalhes: seção "Agent workflow" do `README.md`.
