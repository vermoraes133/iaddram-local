# Publicação no GitHub — 2026-10-22

## Resultado

Repositório público em https://github.com/vermoraes133/iaddram-local, com histórico
reescrito em commit único (autoria via e-mail noreply) e a prévia 0.1.0 como release.

## O que foi feito

- Auditoria: gitleaks (histórico e árvore) sem achados; sem chamadas de rede no código.
- Dependências: SDK MCP 2.3.0, vite 7.3.7 (override) e Vitest 4.1.12; `pnpm audit` limpo.
- Sanitização de referências internas e saída de `CLAUDE.md` e `.iaddram.json` do Git.
- CI (Node 22/24, Linux/macOS, audit), Dependabot, CODEOWNERS, templates, código de conduta.
- Segurança do repositório: secret scanning, push protection, relato privado, proteção da `main`.

## Pendências

- Smoke com cliente Claude real (`apps/local-cli/scripts/verify-claude.mjs`): bloqueado por
  login OAuth expirado do cliente; rodar após `/login`.
- Dependabot de npm falha por `trustPolicy: no-downgrade` (undici-types); decidir exceção ou
  atualização manual.
- Validar cofres Windows/Linux e decidir NPM antes de uma versão stable.
