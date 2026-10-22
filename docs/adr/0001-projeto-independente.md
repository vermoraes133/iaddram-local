# ADR-0001 — Projeto Local independente

Data: 2026-10-18. Estado: aceito para separação local.

## Decisão

A edição Local passa a ter diretório, repositório Git, lockfile, documentação e
ciclo de build/teste/empacotamento próprios. Sua versão inicial permanece 0.1.0.
O usuário solicitou separar os projetos. Publicação GitHub/NPM permanece pendente.

A extração usa os quatro pacotes da distribuição pública previamente preparada:
contracts, memory-kernel, storage-pglite e local-cli. Eles são fontes internas
deste workspace, sem links para o checkout Server. A licença é Apache-2.0.

## Consequências

PGlite, criptografia, busca textual e MCP stdio continuam com seus contratos atuais.
Não há sincronização de memórias ou código automática entre as edições.
Contracts é uma cópia independente; reduzir contratos não utilizados é trabalho futuro.
O Server conserva sua implementação e histórico. A cópia histórica Local na origem
pode ser retirada em mudança separada após revisão dos consumidores.

Credenciais, memórias reais, histórico Git privado, infraestrutura e sessões do Server
não fazem parte da extração. O empacotador opera inteiramente neste repositório.
