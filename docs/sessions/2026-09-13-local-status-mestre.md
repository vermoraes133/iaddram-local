---
created_at: 2026-09-13T16:39:00Z
updated_at: 2026-09-13T16:39:00Z
---

# Diagnóstico e descoberta de memória

Implementado status Local, com manifesto reutilizado do onboard. Estados:
not_adopted, server_check_required, edition_required, unavailable, no_capsule,
ready_to_resume. Coexistência exige seleção explícita de Local. Server não é
consultado pelo CLI; o fluxo próprio permanece necessário.

Saída não contém conteúdo, sessão ou segredo: somente contagens e ID, autor UUID,
datas e idade da última cápsula marcada v1. mcp_client_verified e usage_measured
permanecem false. Pronto significa storage legível com cápsula, não contexto
semanticamente validado ou cliente configurado. Confirmar via start_session no
agente atual e comparar Git/docs antes de continuar.

14 testes Local passaram (3 status, 5 onboard, 6 CLI/MCP). Incluem projeto não
adotado sem criar storage, manifesto inválido, duas edições, cápsula Claude lida
por Codex, chave errada sem substituição, ausência de conteúdo na saída e status
invocado via CLI. Build/lint e Gitleaks export público passaram. Fixture inicial
curta foi corretamente recusada pelo gate de qualidade; corrigida, sem relaxar o gate.

Nenhum deploy.

Artefato: `dist/local-release-bo6LUk/package/iaddram-local-0.1.0.tgz`.
Limites: enumeração até 10 mil registros, nenhum diagnóstico de telemetria Server
ou configuração dos clientes, nenhum juízo automático sobre verdade da cápsula.
