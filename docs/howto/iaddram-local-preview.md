---
created_at: 2026-09-13T07:20:00Z
updated_at: 2026-09-13T15:37:24Z
last_validated_at: 2026-09-13T15:37:24Z
next_review_at: 2027-03-13T07:20:00Z
---

# Experimentar a edição Local

Pré-requisitos: Node.js 22/24, Corepack e cofre do sistema desbloqueado.

## Adotar um projeto

Após build e `init`, execute:

```sh
node apps/local-cli/dist/cli.js onboard --path /caminho/do/projeto --dry-run
node apps/local-cli/dist/cli.js onboard --path /caminho/do/projeto
```

No pacote instalado, basta `iaddram onboard` dentro do projeto. O comando gera
`.iaddram-local.json`, acrescenta blocos em AGENTS/CLAUDE e imprime transportes
MCP sem credenciais. Não altera `.iaddram.json` Server nem configura clientes.
Cadastre a entrada `iaddram_local` no formato aceito pelo cliente e confira suas
quatro tools. Idempotente; symlinks/hardlinks e blocos editados exigem resolução
manual. Use `--project UUID` para identidade Local preexistente. Leve o manifesto
ao mover/clonar o projeto. Não há skill/plugin instalado por este comando.

```sh
corepack pnpm install
corepack pnpm --filter @iaddram/local... build
node apps/local-cli/dist/cli.js init
node apps/local-cli/dist/cli.js doctor
node apps/local-cli/dist/cli.js project --name meu-projeto
```

Copie o UUID retornado e gere a entrada MCP sem credenciais:

```sh
node apps/local-cli/dist/cli.js config --project UUID --agent claude
```

O comando resolve os caminhos do executável e do diretório. Para outro agente,
troque `claude` por `codex`. Configure como MCP separado
do `iaddram` Server existente para que ambos possam coexistir durante o piloto.

O CLI local não lê `.iaddram.json` do Server nem usa suas chaves. Para diretório
isolado, acrescente `--dir /caminho/privado` a todos os comandos. Não apague
`config.json` nem a chave como procedimento de recuperação.

Use start/finish durante sessões. A prévia possui busca textual e cápsulas; não
há embeddings, sincronização ou editor de briefing humano. Os testes de clientes
cruzados são processos MCP de teste com identidades distintas, não uma execução
de modelos Claude/Codex/Grok pagos.

## Backup sem expor a senha

```sh
node apps/local-cli/dist/cli.js export --project UUID --file backup.iaddram
node apps/local-cli/dist/cli.js import --project UUID --file backup.iaddram
```

O terminal oculta a senha; exportação exige confirmação. Para automação, use
`--passphrase-stdin` com pipe protegido do secret manager, nunca argumento ou
arquivo no repositório. A flag recusa stdin interativo. Preserve UUID e senha
para restauração; exportação não sobrescreve arquivo existente.

O teste opcional `node apps/local-cli/scripts/verify-claude.mjs` usa o cliente
Claude instalado e consome sua cota (limite configurado de US$ 1 por execução).
Usa apenas memória sintética e um cofre temporário, removidos no encerramento.
Não faz parte da suíte automática. A tentativa de 2026-09-13 encerrou com código
1 antes de chamar o MCP: integração com o modelo real permanece não validada.

## Preparar a distribuição

```sh
node scripts/package-local.mjs
```

O comando devolve caminhos para `source` (checkout público limpo) e `package`
(CLI compilado). Na pasta `package`, `npm pack` gera o `.tgz`. Em um diretório
temporário independente, instale o arquivo e execute o CLI. O nome de pacote é
candidato; nenhuma disponibilidade no registro NPM foi assumida.

README/SECURITY/NOTICE/LICENSE públicos ficam em `public-local/`. O export inclui
somente quatro pacotes selecionados e não leva histórico ou operação privada.
Gitleaks e auditoria das dependências devem conferir cada candidato final antes
de publicação. Publicar exige resolver a conta/repositório GitHub e o nome NPM.

## Verificar

Dentro do projeto consumidor: `iaddram status` (ou CLI compilado com
`status --path /caminho/do/projeto`). Use o mesmo `--dir` do armazenamento.
Se Server e Local coexistirem, escolha `--edition local` explicitamente para
verificar Local. O Server continua usando seu workflow existente, não é consultado
por este comando. Resultado inclui estado, quantidade de cápsulas e metadados
da última, sem conteúdo. `ready_to_resume` prova apenas leitura do armazenamento;
o agente precisa executar start_session pelo MCP no cliente atual. Exit 0 para
Local acessível (inclusive sem cápsula); exit 2 para estados que exigem atenção.

Não confundir cápsula existente com contexto atualizado: compare data/evidências
com Git e documentos. Não recrie identidade nem rode onboard só porque houve
falha de acesso. Nenhuma gravação de memória ou rotação ocorre no diagnóstico.

```sh
corepack pnpm --filter @iaddram/local... build
corepack pnpm --filter @iaddram/local --filter @iaddram/storage-pglite --filter @iaddram/memory-kernel test
```

A suíte Server continua exigindo Docker. Quando o disco da VM estiver cheio,
`IADDRAM_TEST_DB_TMPFS=1 corepack pnpm test` usa um PostgreSQL temporário real em
tmpfs de 256 MiB, sem limpar volumes de outros projetos.

## Reversão

Remova a entrada MCP Local do cliente para voltar a usar apenas Server. Faça
backup cifrado antes de descartar dados locais. Nenhuma migração de produção
foi executada por este trabalho.
