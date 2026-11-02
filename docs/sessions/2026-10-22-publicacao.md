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

## Revisão de auditoria — 2026-11-02 (v0.1.2)

- `/sync-mestre` (v2.105.3) + revisão de testes e auditoria (§0.2/§20): semgrep, trivy, gitleaks e
  cobertura medida em cópia isolada.
- Achados e correções: zod 4.4.3 (high, GHSA-mrhx-c7xc-m3w5) → 4.6.7; scanner de segredos com
  bypasses (JSON escapado, tokens Slack/Google/Stripe/npm/JWT, PGP, caractere invisível) → endurecido
  com 13 testes novos; Dependabot sem `cooldown` → 7 dias; SDK MCP 2.3.1.
- Branch `agent/manutencao-20261029` (zod ^4.6.6) revisada: correta; a mudança entrou aqui.
- Dependabot: #2, #3 e #5 absorvidos; #6 (TypeScript 7) fechado; #4 (keyring 2.1.1) adiado até
  teste com o cofre real.
- Pendências: threat model (gate #17), seção "Como usar" no README (§0.6.2.1), smoke com cliente real.
