---
project: iaddram-local
tags: [git, git-filter-repo, monorepo, extracao, pnpm, vitest]
status: resolved
created_at: 2026-10-18T03:20:00Z
---

# Extrair um projeto de uma branch com o histórico junto

## Contexto

A edição Local morava na branch uma branch do IADDRAM Server do IADDRAM. Uma primeira
separação copiou só a árvore (sem histórico) para `o diretório local`.

## O que funcionou

1. Clone `--no-local --single-branch` da branch para um diretório temporário.
2. `git filter-repo` com `--path` só nos caminhos do Local e `--path-rename`
   para a nova raiz (`public-local/:` e `scripts/package-local.mjs:scripts/package.mjs`).
3. A árvore preparada entra como um commit em cima. Os arquivos que só existem
   no histórico (ADR-0017, sessões de 2026-09-13) continuam no diretório.

Commits que só tocavam o lockfile da raiz somem no filtro: 6 viraram 4.

## Armadilhas

- O código copiado do Server (`contracts`) ficou fora do filtro de propósito,
  para não puxar histórico privado. A origem fica em `UPSTREAM.md`.
- O lockfile da cópia sem histórico estava defasado em relação ao Server
  (Vitest 3.2.7 com advisory). Separar projeto também significa rodar `audit` de novo.
- O Vitest 4 deixa de ignorar `dist/`: com `tsc` emitindo testes, use `vitest run --dir src`.
