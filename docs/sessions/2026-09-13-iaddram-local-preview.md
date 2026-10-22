---
created_at: 2026-09-13T07:20:00Z
updated_at: 2026-09-13T07:25:00Z
status: completed
agent: codex
---

# Sessão — prévia IADDRAM Local

## Objetivo

Executar o plano aprovado de edição local pública sem banco externo, preservando
a edição Server. Branch uma branch do IADDRAM Server, baseada em `973d01d7`.

## Resultado

Prévia 0.1.0 implementada: três pacotes novos; criptografia e cápsulas extraídas
e usadas pelo Server; Kernel local com contrato de armazenamento; Adapter
PGlite; chave em cofre nativo; CLI e quatro ferramentas MCP com projeto fixo;
backup portátil cifrado, restore transacional, exclusão de registro/índice.

Distribuição gerada por allowlist de fontes: pacote NPM instalável e checkout
público com licença Apache-2.0, README em inglês com seção portuguesa, política
de segurança, contribuição e avisos das dependências incorporadas. Não houve
publicação GitHub/NPM, instalação global, commit, push ou deploy.

## Verificações

- 40 testes Node + 126 Vitest passaram, sem skip, incluindo 32 integrações API
  com PostgreSQL/pgvector e migrations reais.
- Build de 11 workspaces e imagem Server `iaddram:local-kernel-check` com Node 22
  (`734a91cfea26`). Importação e round-trip criptográfico no runtime da imagem passaram.
- Dois processos MCP stdio simultâneos e um terceiro após reinício comprovam
  persistência, proveniência cruzada e isolamento de projeto. São clientes de
  protocolo sintéticos, não invocações pagas de modelos Claude/Codex/Grok.
- Keychain macOS real: credencial sintética gravada/lida/removida; nenhum valor emitido.
- Idempotência, chave incorreta, ruído/segredos, promoção indevida de autoridade,
  ausência de conteúdo-canário no disco, exclusão e conflito de restore cobertos.
- Backup restaurado em armazenamento com chave diferente preserva proveniência.
- Tarball instalado em diretório independente e testado via MCP.
- Candidato final recompilado e testado: 25 testes no checkout público isolado;
  o tarball final passou novamente pelos processos stdio. Init/doctor passaram
  em Node 22 Linux com `--network none` e dados em tmpfs (modo de chave ambiente).
- Gitleaks no export público: zero achado. Semgrep `p/typescript` nos três novos
  módulos: exit 0. NPM audit da instalação Local: zero vulnerabilidade.
- SCA do Server: cinco MODERATE preexistentes em Fastify/Hono; zero HIGH/CRITICAL.
  Atualização desses componentes fica registrada para uma mudança separada.

## Correções feitas durante a verificação

- VACUUM e CHECKPOINT precisam ser instruções separadas; executá-los juntos
  criava um bloco transacional implícito e fazia a exclusão reportar falha.
- proper-lockfile indexa locks pelo alvo canônico: usar dois lockfilePaths para
  o mesmo diretório causava perda de ownership. Inicialização agora trava
  `config.json`; persistência trava o diretório. Ambos têm alvos distintos.
- Inicialização jamais troca a chave quando há config existente ou dados sem config.
- Falhas iniciais dos testes API vieram do disco cheio da VM Docker: o log de
  initdb informou `No space left on device`. Adicionado opt-in de teste
  `IADDRAM_TEST_DB_TMPFS=1` (256 MiB). Nenhum volume alheio foi removido.
- Contêiner diagnóstico sintético `iaddram-local-test-db` e seu volume temporário
  foram removidos; não continham dados do usuário.

## Artefatos

- Candidato final em `dist/local-release-KFVYh7/` (gerado, fora do Git).
- `package/iaddram-local-0.1.0.tgz`: instalável; dependências externas são
  baixadas na instalação, não nas operações de memória.
- `source/`: fontes públicos isolados, sem histórico, sessões ou infraestrutura.
- Fontes versionáveis: `scripts/package-local.mjs`, `public-local/`, ADR-0017,
  how-to, pacotes e atualização do Dockerfile para o Kernel.

## Limites e próximos passos

- Validar cofres Windows/Linux e experiência real nos clientes antes de stable.
- Definir conta/repositório GitHub e nome de pacote NPM antes de publicar.
- Sem embeddings, GUI, sync, editor humano de briefing ou bitemporalidade completa.
- Server compartilha primitivas, mas seu repositório PostgreSQL ainda não foi
  adaptado à nova Interface MemoryStore. Não anunciar paridade completa.
- Checkpoints são explícitos durante trabalho: corte abrupto não grava contexto
  que o agente nunca transmitiu. Recuperações permanecem evidência citada.
- Snapshot alheio `2026-08-21-exporta-o-vertical-9-16-de-clipes.md` preservado.
