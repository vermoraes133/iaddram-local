---
created_at: 2026-09-13T16:05:20Z
updated_at: 2026-09-13T16:05:20Z
---

# Comando de adoção Local

Implementado `iaddram onboard` na branch existente uma branch do IADDRAM Server.
Pré-requisito: `init`. `--path` escolhe o projeto, `--project` reutiliza UUID,
`--name` define nome e `--dry-run` não escreve nem lockfile. Sem UUID explícito,
a primeira identidade deriva do store e caminho; depois o manifesto é canônico.

Escreve somente `.iaddram-local.json`, AGENTS.md e CLAUDE.md no diretório alvo.
Blocos são anexados, nunca substituem regras existentes. Configurações MCP são
retornadas sem chave para cadastro pelo usuário, no formato aceito pelo cliente.
Não instala skill/plugin, não adota Server, não configura clientes globais e
não inicia automaticamente sessões de modelos.

Cinco testes de adoção passaram: dry-run e preservação, links recusados,
conflitos de identidade/bloco recusados, concorrência, separação de projetos e
manifesto inválido. Seis testes CLI/MCP passaram, incluindo onboard via processo
e chamada start_session no transporte gerado. Build Local e lint passaram.

Limites: arquivos linked exigem revisão manual; gravação não é transação entre
arquivos, interrupção exige rerun ou correção manual de bloco incompleto. Nunca
prometer checkpoint após corte abrupto. Testes não substituem Claude real.

README público, how-to, changelog e CONTEXT atualizados. Nenhuma alteração em
projeto consumidor real, nenhum commit, deploy ou publicação nesta rodada.

Pacote atualizado: `dist/local-release-Lwzxhy/package/iaddram-local-0.1.0.tgz`.
Gitleaks no export público e npm audit da instalação isolada: zero achados.
