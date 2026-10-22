# 03 — Release

Não há deploy de servidor. Release = pacote instalável:

```sh
corepack pnpm package
```

O tarball fica em `dist/`. Publicação em GitHub/NPM ainda não foi decidida.
Antes de publicar, confira o artefato: instale o tarball isolado e rode os testes CLI/MCP contra ele.
