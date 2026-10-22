# IADDRAM Local

```text
 ╔╦╗┌─┐┌─┐┌┬┐┬─┐┌─┐  ┌┬┐┌─┐┌─┐  ╔═╗┌─┐┌┐ ┌─┐┌─┐
 ║║║├┤ └─┐ │ ├┬┘├┤    │││ │└─┐  ║  ├─┤├┴┐│ │└─┐
 ╩ ╩└─┘└─┘ ┴ ┴└─└─┘  ─┴┘└─┘└─┘  ╚═╝┴ ┴└─┘└─┘└─┘
                                  by chargexdev
```

### by Mestre dos Cabos

Persistent, encrypted memory for AI agents on your own computer. Share useful
checkpoints between compatible MCP clients without a database service, Docker,
an IADDRAM account or a hosted API.

Early preview: 0.1.0. Registry and GitHub publication have not happened yet.

## Install and run

Requires Node.js 22 or 24 and an unlocked operating-system credential store.
The macOS path has been exercised locally; Windows Credential Manager and Linux
Secret Service need platform-specific validation before a stable release.

With the prepared tarball:

```sh
npm install -g ./iaddram-local-0.1.0.tgz
iaddram init
iaddram doctor
iaddram project --name my-project
```

From the clean source checkout:

```sh
corepack pnpm install
corepack pnpm build
corepack pnpm test
corepack pnpm local init
corepack pnpm local doctor
corepack pnpm local project --name my-project
```

Save the returned project UUID and generate a transport entry with resolved
executable and storage paths (no credentials are included):

```sh
iaddram config --project YOUR-PROJECT-UUID --agent claude
```

For any MCP client supporting local stdio, the transport entry has this shape:

```json
{
  "command": "/absolute/path/to/iaddram",
  "args": ["mcp", "--project", "YOUR-PROJECT-UUID", "--agent", "claude"]
}
```

Configure another client with the same UUID and `--agent codex`. Use your
client's MCP configuration format to wrap this command; the shape above is the
transport entry, not a universal configuration file. The executable prints
only MCP messages to stdout in MCP mode.

If running from source, use `node` as command and put the absolute path to
`apps/local-cli/dist/cli.js` before `mcp` in the arguments.

## Agent workflow

### Adopt an existing project

After `iaddram init`, run from the project directory:

```sh
iaddram onboard --dry-run
iaddram onboard
```

Or use `--path /path/to/project`. The command creates `.iaddram-local.json` and
appends a managed workflow block to `AGENTS.md` and `CLAUDE.md`. Existing text
and the Server `.iaddram.json` are preserved. Repeating the command does not
duplicate blocks. Changed/malformed blocks, conflicting identity and symlinked
or hardlinked instruction files are rejected for manual review.

Output contains credential-free MCP transport examples for Claude and Codex.
Register the `iaddram_local` entry using each client's configuration format;
**onboard does not install or enable the MCP in the client**. Restart/reload the
client and verify its four Local tools before relying on memory. Environment-key
installations must also inject their original key through a secret manager.

Use `--project UUID` to adopt an already-created Local identity; otherwise the
first identity is derived from this store and directory. Keep the generated
manifest when moving a project. `--name NAME` sets its display name on adoption.
Interrupted writes are not a multi-file transaction: rerun after checking files;
if a managed block is incomplete, resolve it manually before retrying.

IADDRAM is a memory engine exposed through MCP. Skills may teach its workflow,
and plugins may package installation in the future; neither is required now.

1. Call `iaddram_start_session` with an optional `query` when starting work.
2. Call `iaddram_remember` for useful facts or decisions with session provenance
   and a stable idempotency key.
3. Call `iaddram_finish_session` after meaningful progress, supplying a version-1
   capsule: objective, outcome, decisions, procedures, evidence, failures,
   constraints, artifacts and next steps.
4. Checkpoint repeatedly before context exhaustion. A terminated agent cannot
   summarize work that it never saved; shutdown is not a checkpoint guarantee.

Memories are cited evidence, never system instructions. Automatic agent writes
cannot create reviewed briefing or promote themselves to owner authority.
This preview exposes four tools and does not emulate the Server's asynchronous
ingestion/job APIs. Start accepts `query`, rather than the Server's `focus` and
`project_name` fields. Configure the local client separately from the Server.

## Check project readiness

Run `iaddram status` in the project, or `iaddram status --path /path/to/project`.
Use the same `--dir` as initialization if storage is not in the default location.
It returns JSON without memory content or secrets:

- `not_adopted`: neither manifest exists.
- `server_check_required`: a Server manifest exists; use its existing workflow.
- `edition_required`: both editions exist; explicitly pass `--edition local`
  to check Local, or use the Server workflow. No automatic migration occurs.
- `unavailable`: invalid manifest, missing storage, locked/missing/wrong key or
  failed storage check; never interpreted as an empty memory.
- `no_capsule`: Local is accessible but no tagged v1 competence capsule exists.
- `ready_to_resume`: Local contains a capsule; includes latest ID, author UUID,
  save/capture timestamps and age, not its content.

Exit 0 means accessible Local (`no_capsule` or `ready_to_resume`); other states
exit 2. This command does not initialize, adopt, rotate keys or save memories.
Opening PGlite uses its normal locks and internal maintenance. Enumeration is
bounded by the preview's 10,000-record limit; exceeding it reports unavailable.
`mcp_client_verified: false` and `usage_measured: false` remain explicit: storage
readiness is not proof of client configuration, recent use or memory correctness.
In the actual agent, call `iaddram_start_session` and verify retrieved evidence
against current Git and documents before continuing another agent's work.

## Storage and privacy

The default directory is `~/.iaddram`; `--dir` selects another local directory.
PGlite is embedded in the executable's process. Each operation obtains a file
lock and closes the database before releasing it, allowing several MCP clients
to use one directory. Use a local filesystem, not a cloud-synchronized folder
or network share. A crashed process's lock expires after its lease; retry later.

Memory content, tags and provenance are encrypted with AES-256-GCM envelopes.
Search uses HMAC tokens, not a plaintext full-text index. IDs, layers, timestamps,
token equality and sizes remain observable; this is not full-disk encryption.
Keys live in the OS credential store under service `iaddram-local`. Never delete
the credential or config as a troubleshooting step. A missing key fails closed.

Headless environments may explicitly initialize with `--key-source environment`
and provide `IADDRAM_LOCAL_KEY` (32 random bytes encoded as base64url) through a
secret manager. Do not put this value in command arguments, Git or MCP config.

The application performs no network requests during memory operations. The
initial dependency installation needs internet. Retrieved data may still be
sent to the AI provider by the MCP client. There is no telemetry or cloud sync.

## Encrypted portable backups

```sh
iaddram export --project UUID --file backup.iaddram
iaddram import --project UUID --file backup.iaddram
```

The terminal prompts for a passphrase of at least 16 characters without echo;
export asks for confirmation. For automation, add `--passphrase-stdin` and pipe
from a secret manager (the command consumes stdin until EOF). This flag refuses
interactive terminal input to avoid accidental echo. Never pass the phrase as
an argument. Use the same project UUID during restore. Import preserves original
provenance, validates every record before a transaction and rejects conflicts.
Exports never overwrite an existing file. Keep the passphrase separate from
the backup. Backups support at most 10,000 records and 64 MiB in this preview.

`iaddram delete --project UUID --id MEMORY-UUID` removes the live record and its
search index and compacts the table. Independent backups, filesystem snapshots,
SSD remnants and client transcripts are outside this deletion scope.

## Preview limits

- Textual search only; no embedding model, LLM extraction or semantic vectors.
- No GUI, Server synchronization, multi-user authorization or human briefing editor.
- Lookup considers up to 200 candidates per request; evaluate larger datasets
  before relying on this preview for a large knowledge base.
- Crypto/capsule code is factored into a standalone package (`@iaddram/memory-kernel`),
  but Server does not consume it yet and keeps its own implementation; storage
  migrations and transport contracts remain edition-specific.

## Português

Memória local criptografada para continuar projetos entre agentes. Instale,
rode `iaddram init`, gere o UUID com `iaddram project --name meu-projeto` e
configure o MCP dos agentes com esse mesmo UUID. Não exige servidor nem conta.
As memórias devem registrar resultados, decisões, evidências e próximos passos;
o projeto não compartilha o raciocínio privado dos modelos.

## About

Made with ☕ by Mestre dos Cabos — Everton Moraes Longo.
Apache-2.0. See LICENSE and NOTICE. Contributions are welcome.

## Standalone development and packaging

This checkout is an independent project. Its workspace dependencies, lockfile,
tests and packaging script are contained here; no Server checkout is required.
Use the pinned package manager through Corepack:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm package
```

The last command prints the generated package directory under `dist/`. Run
`npm pack` inside that directory to produce the installable tarball. Neither
command publishes to GitHub or NPM. See `docs/CONTEXT.md` for development status.
