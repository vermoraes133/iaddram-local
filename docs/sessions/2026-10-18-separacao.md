# Handoff — projeto independente

Data: 2026-10-18.

## Resultado

Edição Local 0.1.0 extraída para repositório independente, com quatro pacotes
internos, documentação, licença Apache-2.0, lockfile e empacotador próprios.
Git inicializado em main; primeiro commit e remote ainda pendentes.

## Verificação

- Instalação offline com lockfile congelado passou.
- Build, typecheck e 40 testes passaram (21 contratos, 2 kernel, 3 PGlite, 14 CLI/MCP).
- Gitleaks sem achados e audit de produção sem vulnerabilidades conhecidas.
- Tarball gerado e instalado isoladamente offline.
- Links de workspace resolvem apenas dentro deste repositório.

## Decisões operacionais

Use Corepack: o pnpm global pode ser diferente da versão fixada.
Check executa build antes de typecheck porque pacotes internos exportam declarations compiladas.
O lockfile preserva versões da origem; resolução nova encontrou bloqueio de procedência
em dependência transitiva. A política de confiança foi preservada.
Nenhuma memória, chave ou configuração de cliente foi migrada.

## Próximos passos

Definir destino GitHub e autorizar primeiro commit/publicação. Validar clientes
reais e cofres Windows/Linux antes de stable. Atualizações de dependências futuras
pertencem a este projeto; não há sincronização automática com o Server.

## Verificação do artefato final

Os seis testes CLI/MCP também passaram contra o tarball instalado isoladamente,
incluindo checkpoint/recall por processos stdio e backup/restore cifrado.

## Segunda rodada — histórico e dependências

- Histórico extraído com `git filter-repo`; `contracts` como cópia versionada (ADR-0002, `UPSTREAM.md`, `scripts/check-contracts-upstream.mjs`).
- Vitest 4.1.11 e source-map-js 1.2.2 fecharam dois advisories herdados no lockfile.
- Nenhuma memória, chave ou configuração de cliente foi migrada.
