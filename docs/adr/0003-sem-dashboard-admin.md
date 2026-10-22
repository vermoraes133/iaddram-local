# ADR-0003 — Sem dashboard admin, API exposta ou deploy em servidor

Data: 2026-10-18. Estado: aceito pelo owner.

## Decisão

O Local é um CLI single-user que roda no computador de quem o instala. Não tem
login, não serve HTTP e não roda 24/7. Por isso não adota dashboard administrativo nem API HTTP. O MCP é stdio local.

## Revisão

Reabrir se o Local ganhar sincronização com o Server, interface gráfica ou serviço de rede.
