# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado
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
