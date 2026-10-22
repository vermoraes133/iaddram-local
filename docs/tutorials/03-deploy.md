# 03 — Release

Não há deploy de servidor. Release = pacote instalável:

```sh
corepack pnpm package
```

O tarball fica em `dist/`. Release no GitHub: anexe o tarball gerado por `npm pack` a uma release marcada como prévia. NPM ainda não foi decidido.
Antes de publicar, confira o artefato: instale o tarball isolado e rode os testes CLI/MCP contra ele.
