# Contributing

Use Node.js 22 or 24 and the pinned pnpm version via Corepack.
Run `corepack pnpm install`, `corepack pnpm build` and `corepack pnpm test`.
The local tests use temporary directories and synthetic keys; no database
service, external account or production data is required.

Keep storage behind MemoryStore. Preserve capsule and encryption wire formats.
For changes to persistence, test restart, concurrent clients, wrong keys,
idempotency, project isolation and restore conflicts. Never add network calls
to default local memory operations or log memory content.

Open a focused pull request with a description of the resulting behavior and
the checks performed. Contributions to this distribution use Apache-2.0.
