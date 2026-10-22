# ADR-0002 — `contracts` como cópia versionada do Server

Data: 2026-10-18. Estado: aceito pelo owner.

## Contexto

Depois da separação (ADR-0001), o único código que o Local ainda tira do IADDRAM
Server é `@iaddram/contracts`. O kernel usa dele sete símbolos de validação e
qualidade. `memory-kernel` e `storage-pglite` são só do Local: o Server mantém
a própria implementação de cápsula e criptografia e compartilha só o formato
(ADR-0017, nota de 2026-09-29).

## Decisão

`packages/contracts` fica como cópia versionada. `packages/contracts/UPSTREAM.md`
registra commit, versão e diferenças locais. `scripts/check-contracts-upstream.mjs`
compara a cópia com um checkout do Server quando ele existir.

## Alternativas descartadas

- **Submódulo:** aponta para o repositório privado do Server. Quem clonar o Local
  (Apache-2.0) não consegue resolver a dependência.
- **Pacote publicado:** obriga a decidir a licença e o processo de release de código
  do Server só por sete símbolos.

## Consequências

Não há sincronização automática. Mudanças nos contratos do Server só chegam ao
Local por decisão explícita, com testes. Se Server e Local passarem a dividir mais
código (por exemplo, o Server consumir `memory-kernel`), esta decisão é revista
em favor de pacote publicado.
