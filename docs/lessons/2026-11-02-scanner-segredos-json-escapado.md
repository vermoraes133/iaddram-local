---
project: iaddram-local
tags: [seguranca, secret-scan, regex, json, unicode, mcp]
status: resolved
created_at: 2026-11-02T04:20:00-03:00
---

# Scanner de segredos que olha o JSON serializado perde o que está dentro do conteúdo

## Contexto

O kernel escaneava `JSON.stringify(input)` para recusar credenciais. Um `{"password":"…"}`
dentro do texto da memória vira `{\"password\":\"…\"}` e a regex `password\s*[:=]` não casa, porque
há `\"` entre a palavra e o `:`. Medido na auditoria do Mestre (§20): também passavam tokens
Slack, Google, Stripe, npm, JWT, chaves PGP/DSA/criptografadas e um `AKIA` com caractere invisível.

## O que funcionou

1. Escanear variantes do texto: original, normalizado (NFKC, sem caracteres de largura zero) e sem
   escapes JSON.
2. Aceitar aspas entre o nome da chave e o separador, e ampliar os padrões.
3. Fixtures de teste montadas por concatenação em tempo de execução: o código-fonte não contém
   tokens literais, então gitleaks e push protection não disparam.

## Para o futuro

Gate de segredo precisa de teste negativo por formato, não só de um caso feliz (§20.24): cobertura de
20% no arquivo era o sinal. O scanner continua sendo heurístico; o README documenta o limite.
