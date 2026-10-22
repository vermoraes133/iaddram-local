---
created_at: 2026-09-13T15:37:24Z
updated_at: 2026-09-13T15:37:24Z
---

# Local: configuração e backup seguros

## Resultado

- CLI `config` emite transporte MCP com caminhos absolutos, projeto e agente,
  sem incluir chave. Teste conecta ao MCP usando a configuração gerada.
- Export/import pedem senha oculta quando há TTY. Export exige confirmação.
  `--passphrase-stdin` exige pipe; sem terminal nem flag, falha fechada.
- Testes adicionais comprovam inicialização concorrente, recusa de substituir
  configuração perdida sobre dados existentes e recusa de sobrescrever backup.
- README público e how-to atualizados. Server e implantação não alterados nesta
  continuação; mudanças compartilhadas da prévia anterior continuam na branch.

## Evidências

- `IADDRAM_TEST_DB_TMPFS=1 corepack pnpm test`: 40 Node + 129 Vitest, sem skips.
- Lint, typecheck e build Local passaram.
- Terminal real via `script`: senha digitada duas vezes não apareceu no output;
  backup criado com sucesso. Dados eram sintéticos e foram removidos.
- Gitleaks no source público regenerado: zero achado.
- Pacote: `dist/local-release-85so8V/package/iaddram-local-0.1.0.tgz`.
- Tarball instalado isoladamente passou os cinco testes CLI/MCP; `npm audit
  --omit=dev` retornou zero vulnerabilidade nessa instalação.
- Checkpoint Server registrado: `cb387b4b-b021-4bf5-96ed-7f79d9f5247b`.

## Lacunas e próximo passo

- `apps/local-cli/scripts/verify-claude.mjs` é opt-in, usa só memória sintética e
  apaga sua entrada temporária do Keychain. Tentativa com Claude real falhou:
  exit 1, tool_called=false, marker_verified=false, timed_out=false. Diagnósticos
  de conta foram descartados; causa específica não confirmada. Não confundir os
  testes de protocolo/processos com uma validação do modelo real.
- Falta conta/organização GitHub de destino; pergunta enviada ao owner.
- Validar modelos/clientes reais, Windows Credential Manager e Linux Secret
  Service. Linux headless anterior não valida Secret Service.
- Sem commit, push ou deploy. Snapshot antigo de outro trabalho foi preservado.
