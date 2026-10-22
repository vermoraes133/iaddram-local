---
created_at: 2026-09-13T07:20:00Z
updated_at: 2026-09-13T07:20:00Z
last_validated_at: 2026-09-13T07:20:00Z
next_review_at: 2027-03-13T07:20:00Z
status: accepted
---

# ADR-0017 — IADDRAM Local e núcleo compartilhado

> **Nota de reconstrução (2026-09-29):** o trabalho desta ADR foi implementado
> em 2026-09-13 mas nunca commitado, e ficou preso sem git em uma branch
> parada. Reconstruído em cima do main atual em 2026-09-29, deliberadamente
> **sem** a parte que fazia o Server reexportar `packages/memory-kernel`
> (`competence-capsule.ts`/`memory-crypto.ts` viravam re-export do kernel,
> mais o `COPY` correspondente no Dockerfile) — isso acoplaria o Server à
> edição Local antes de existir decisão própria sobre publicar isso como
> projeto separado. O texto abaixo descreve o desenho original; onde ele diz
> que o Server já consome o kernel, isso ainda não é verdade em `main`.

## Contexto

O owner aprovou criar uma edição local e preparar uma distribuição pública para
uso por outras pessoas. O sistema atual é a edição Server: PostgreSQL, RLS, API,
MCP remoto, workers e operação multi-tenant. A decisão anterior contra SQLite
em ADR-0001 se referia a essa API concorrente, não a um aplicativo single-user.

## Decisão

- Server permanece em sua infraestrutura atual. A edição Local
  desenvolve a edição Local 0.1.0 como prévia.
- `packages/memory-kernel` contém criptografia e cápsulas extraídas sem alterar
  seu formato. Desenho original: Server importaria essas implementações por
  reexportações compatíveis — **não aplicado em `main`** (ver nota acima);
  Server mantém sua própria implementação, sem depender do kernel.
- O novo `MemoryKernel` usa `MemoryStore`, sem HTTP, Drizzle ou pg.Pool. O primeiro
  Adapter é PGlite; regras de escrita/recall do Server ainda permanecem em seu
  repositório PostgreSQL. A migração completa desse Adapter é trabalho posterior.
- PGlite 0.5.8 persiste localmente, sem servidor. Uma instância abre e fecha sob
  lock por operação para compartilhar o diretório entre processos MCP.
- A chave reside no cofre nativo via `@napi-rs/keyring`; ambiente é alternativa
  explícita para execução headless. Ausência de chave nunca dispara rotação.
- Conteúdo, tags e proveniência são cifrados como um envelope; busca lexical usa
  HMAC. IDs, camada, timestamps, tamanhos e igualdade de tokens são metadados observáveis.
- Cada cliente MCP é fixado a um projeto e registra sua identidade informativa;
  o mesmo usuário do sistema operacional é a fronteira de confiança.
- Exportação cifrada usa senha independente e scrypt com parâmetros fixos;
  importação transacional preserva proveniência e rejeita conflitos.
- A distribuição selecionada Local usa Apache-2.0; Server e histórico privado
  permanecem fora do export. A licença raiz proprietária não é substituída.
- Preparação pública por allowlist em `scripts/package-local.mjs`: fontes limpos
  e pacote autossuficiente. Não publica GitHub/NPM nem copia histórico, sessões,
  infraestrutura ou credenciais.

## Alternativas

PGlite reduz o esforço inicial por manter semântica PostgreSQL e transações. A
limitação de acesso concorrente é resolvida por lock e fechamento por operação,
com custo de inicialização mensurado pelos testes. SQLite/FTS5 é um Adapter
possível no futuro. JSON/Markdown é formato de intercâmbio, não fonte transacional.

## Limites da prévia

Quatro ferramentas MCP locais, contratos explícitos próprios; sem emulação de
jobs/ingestão remota. Busca textual, até 200 candidatos; sem embeddings. Agentes
não escrevem briefing revisado. Editor humano de briefing, sincronização,
interface gráfica, bitemporalidade completa e migração do repositório PostgreSQL
para o novo Kernel não entram nesta prévia. A saída do MCP pode ser enviada ao
provedor pelo cliente; armazenamento local não impede isso.

Exclusão remove registros e índices vivos e compacta a tabela. Backups externos,
snapshots do filesystem e remanescentes do SSD exigem tratamento próprio; não
prometemos apagamento forense. Não há checkpoint garantido após término abrupto:
o cliente deve salvar durante o trabalho.

## Fontes

- [PGlite API](https://pglite.dev/docs/api)
- [PGlite e concorrência](https://pglite.dev/docs/pglite-socket)
- [Keyring nativo](https://github.com/Brooooooklyn/keyring-node)
- [proper-lockfile](https://github.com/moxystudio/node-proper-lockfile)

## Verificação

Testes com PGlite real: persistência após reabertura, identidades cruzadas,
processos stdio concorrentes, chave errada, isolamento de projeto, idempotência,
qualidade, segredos, backup com outra chave, rollback de conflito e ausência do
conteúdo-canário nos arquivos. Keychain real validado com entrada sintética
temporária, removida ao final. Windows/Linux keyring ainda requerem validação.
