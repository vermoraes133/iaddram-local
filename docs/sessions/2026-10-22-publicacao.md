# Publicação no GitHub — 2026-10-22

## Resultado

Repositório público em https://github.com/vermoraes133/iaddram-local, com histórico
reescrito em commit único (autoria via e-mail noreply). Releases: v0.1.0 (substituída) e
v0.1.1 (atual, prévia).

## O que foi feito

- Auditoria: gitleaks (histórico e árvore) sem achados; sem chamadas de rede no código.
- Dependências: SDK MCP 2.3.0, vite 7.3.7 (override) e Vitest 4.1.12; `pnpm audit` limpo.
- Sanitização de referências internas e saída de `CLAUDE.md` e `.iaddram.json` do Git.
- CI (Node 22/24, Linux/macOS, audit), Dependabot, CODEOWNERS, templates, código de conduta.
- Segurança do repositório: secret scanning, push protection, relato privado, proteção da `main`.

## Assinatura e v0.1.1

- Mestre (§0.6.4): `iaddram --about` e `--version`, `author: "Mestre dos Cabos"` nos pacotes (sem
  e-mail, decisão do owner), copyright do `NOTICE` no formato do portfólio, bloco About no README.
- Dependabot de npm: `undici-types@6.21.0` em `trustPolicyExclude`; a política `no-downgrade`
  continua para o resto. Se voltar a falhar, avaliar a nova versão antes de ampliar a exceção.
- Release v0.1.1 com tarball e SHA-256; testada em instalação isolada e com CI verde.

## Pendências

- Smoke com cliente Claude real (`apps/local-cli/scripts/verify-claude.mjs`): bloqueado por
  login OAuth expirado do cliente; rodar após `/login`.
- Atualizar o registro do projeto no LIBCODE (`/libcode-sync`), que depende de credenciais do owner.
- Validar cofres Windows/Linux e decidir NPM antes de uma versão stable.
