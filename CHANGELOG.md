# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado
- `docs/threat-model.md` (STRIDE) e seção "Como usar" no README.

### Alterado
- PGlite 0.5.11, keyring 2.1.2, SDK MCP 2.4.0, Vitest 5.0.5 e `@types/node` 22.20.5.
  Compatibilidade de dados do PGlite verificada nos dois sentidos e keyring testado no Keychain real.

## [0.1.2] — 2026-11-02

### Segurança
- `scanForSecrets` endurecido: detecta segredos em JSON serializado, normaliza Unicode e remove
  caracteres invisíveis; novos padrões (Slack, Google, Stripe, npm, JWT, chaves PGP/DSA/criptografadas).
  Divergência registrada em `packages/contracts/UPSTREAM.md`.
- zod 4.6.7 (GHSA-mrhx-c7xc-m3w5, esgotamento de memória) e SDK MCP 2.3.1.
- Dependabot com `cooldown` de 7 dias; majors de TypeScript e `@types/node` ignorados.

## [0.1.1] — 2026-10-22

### Adicionado
- `iaddram --about` e `--version` com a assinatura do Mestre dos Cabos; campo `author` nos pacotes.
- CI no GitHub (Node 22/24, Linux/macOS, audit), Dependabot, CODEOWNERS e templates.
- `CODE_OF_CONDUCT.md` e metadados `repository` nos pacotes.

### Alterado
- SDK MCP 2.3.0 (GHSA-jm63-cq47-j5jp, GHSA-46jr-4wx8-v453); vite 7.3.7 (GHSA-587h-7wmj-h5pm).
- Projeto separado do IADDRAM Server, com histórico preservado (ADR-0001).
- `packages/contracts` passa a ser cópia versionada do Server (ADR-0002).
- Vitest 4.1.12 (GHSA-82fw-gwwq-j7x9 e @vitest/mocker) e source-map-js 1.2.2 (GHSA-68fv-2mgg-jv7q).

## [0.1.0] — 2026-09-29

### Adicionado
- Prévia da edição Local: CLI `iaddram`, PGlite cifrado, quatro ferramentas MCP stdio,
  `onboard`, `status`, backup e restauração cifrados.
