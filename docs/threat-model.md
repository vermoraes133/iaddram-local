---
project: iaddram-local
created_at: 2026-11-02T04:35:00-03:00
last_validated_at: 2026-11-02
next_review_at: 2027-02-02
---

# Modelo de ameaças — IADDRAM Local

Método: STRIDE sobre o fluxo real do produto. Revisar quando mudar a superfície de ataque
(nova ferramenta MCP, rede, sincronização, formato de cápsula, criptografia ou backup).

## O que protegemos

| Ativo | Onde fica |
|---|---|
| Conteúdo, tags e proveniência das memórias | Banco PGlite local, cifrados (AES-256-GCM, DEK por memória) |
| Chave mestra (KEK) | Cofre do sistema (`iaddram-local`) ou `IADDRAM_LOCAL_KEY` no modo ambiente |
| Backups portáteis `.iaddram` | Arquivo cifrado com passphrase (scrypt, mín. 16 caracteres) |
| Integridade do contexto que o agente recebe | Memórias entram como evidência citada, nunca como instrução |

## Fronteiras de confiança

1. **O usuário do sistema operacional é a fronteira.** Qualquer processo que rode como esse usuário
   com o cofre desbloqueado pode ler a chave e os dados. Local não é sandbox contra software hostil
   no mesmo usuário e não tem RBAC multiusuário.
2. **Cada processo MCP é fixado em um projeto** (`--project`). O kernel recusa outro projeto e o AAD
   da cifra inclui projeto e id, então uma linha copiada para outro projeto não decifra.
3. **O cliente MCP e o provedor de IA estão fora da fronteira.** O que o agente recupera pode ser
   enviado ao provedor do modelo; transcritos do cliente guardam esse conteúdo.
4. **Sem rede.** As operações de memória não fazem chamadas de rede (teste e revisão de código).

## Ameaças (STRIDE)

| # | Ameaça | Mitigação atual | Risco residual |
|---|---|---|---|
| S1 | Cliente se passa por outro agente (`--agent`) | Id do agente derivado do rótulo; agentes não criam briefing nem autoridade acima de `inform` | O rótulo não é autenticado: qualquer processo do usuário escolhe o nome |
| S2 | Troca de chave (outra chave aberta sobre os dados) | Verificador de chave cifrado em `local_meta`; falha fechada; nunca reinicializa sobre dados existentes | Perda do cofre sem backup = perda dos dados (por desenho) |
| T1 | Adulteração de linhas no banco | AES-GCM autenticado com AAD (versão de chave, tenant, projeto, id); linha alterada não decifra | Remoção ou reversão de linhas inteiras (rollback) não é detectada |
| T2 | Memória envenenada tenta virar instrução | Dado citado com proveniência; escrita de agente fixada em `inform`/`automatic`; briefing exige revisão humana | Um modelo pode seguir texto malicioso recuperado; depende do cliente respeitar o aviso |
| T3 | Segredo gravado por engano na memória | `scanForSecrets` (variantes normalizadas, sem escapes JSON; 11 padrões) e gate de qualidade | Heurístico: segredos fora dos padrões passam. Não é prevenção completa |
| R1 | Negar autoria de uma escrita | Proveniência gravada (agente, sessão, horário) dentro do registro cifrado | Sem log assinado; quem controla o usuário do SO controla o registro |
| I1 | Vazamento por metadados | Conteúdo, tags e proveniência cifrados | Ids, camada, horários, tamanhos e igualdade de tokens de busca (HMAC) ficam visíveis |
| I2 | Vazamento por backups, snapshots e SSD | Backup cifrado; exclusão compacta a tabela | Cópias antigas, snapshots e remanescentes de SSD estão fora do escopo da exclusão |
| I3 | Segredo na linha de comando ou no Git | Passphrase só por prompt ou stdin; chave por cofre; `.gitignore`, gitleaks e push protection | Quem põe a chave em `.env` versionado ignora a regra |
| D1 | Esgotamento de recursos | Limites: 10.000 registros, backup 64 MiB, 200 candidatos por consulta; zod atualizado (GHSA-mrhx-c7xc-m3w5) | Um processo local do mesmo usuário pode travar o lock até a lease expirar (30 s) |
| D2 | Banco travado por dois clientes | Lock por operação com lease; PGlite fecha a cada operação | Lentidão sob muitos clientes simultâneos |
| E1 | Cadeia de suprimentos (dependências e releases) | Lockfile, versões fixas, `minimumReleaseAge` 7 d, `trustPolicy` no-downgrade, audit e CodeQL no CI, Dependabot com cooldown, actions por SHA | Tarball publicado com SHA-256, sem assinatura nem provenance (npm) ainda |
| E2 | Chave do cofre acessível a outros apps | Entrada do cofre do SO sob o serviço `iaddram-local` | Windows e Linux (Secret Service) não foram validados |

## Pendências priorizadas

1. Subchaves por finalidade (HKDF) para embrulho, busca e fingerprint: hoje uma KEK serve a três usos,
   separados só por prefixo. Muda o formato: exige teste de compatibilidade (AGENTS.md).
2. Assinar releases e publicar com provenance quando houver registro npm.
3. Validar cofres Windows e Linux antes de uma versão estável.
4. Detectar rollback de linhas (contador ou raiz de integridade).
5. Revalidar este documento a cada mudança de superfície ou até 2027-02-02.
