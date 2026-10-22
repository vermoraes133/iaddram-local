import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup } from './backup.js';
import { initialize, type KeyStore, openRuntime } from './runtime.js';

const directories: string[] = [];
const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function directory() {
  const dir = await mkdtemp(join(tmpdir(), 'iaddram-cli-test-'));
  directories.push(dir);
  return dir;
}
const cli = resolve(process.env.IADDRAM_LOCAL_TEST_CLI ?? 'dist/cli.js');
async function command(args: string[], key: string, stdin?: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      env: { ...process.env, IADDRAM_LOCAL_KEY: key },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    child.on('error', reject);
    child.on('exit', (code) => done({ code, stdout, stderr }));
    child.stdin.end(stdin);
  });
}
async function connect(dir: string, key: string, project: string, agent: string) {
  const client = new Client({ name: agent, version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli, 'mcp', '--dir', dir, '--project', project, '--agent', agent],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      IADDRAM_LOCAL_KEY: key,
    },
    stderr: 'pipe',
  });
  clients.push(client);
  await client.connect(transport);
  return client;
}
describe('local CLI and MCP', () => {
  it('adopts a project through the CLI and connects with the emitted transport', async () => {
    const dir = await directory();
    const projectPath = await directory();
    const key = randomBytes(32).toString('base64url');
    expect((await command(['init', '--dir', dir, '--key-source', 'environment'], key)).code).toBe(
      0,
    );
    const args = ['onboard', '--dir', dir, '--path', projectPath];
    const preview = await command([...args, '--dry-run'], key);
    expect(preview.code).toBe(0);
    const adopted = await command(args, key);
    expect(adopted.code).toBe(0);
    expect(adopted.stdout).not.toContain(key);
    const result = JSON.parse(adopted.stdout);
    const status = await command(['status', '--dir', dir, '--path', projectPath], key);
    expect(status.code).toBe(0);
    expect(JSON.parse(status.stdout).status).toBe('no_capsule');
    expect(JSON.parse(status.stdout).mcp_client_verified).toBe(false);
    expect(result.project_id).toBe(JSON.parse(preview.stdout).project_id);
    expect(JSON.parse((await command(args, key)).stdout).changed_files).toEqual([]);
    const client = new Client({ name: 'onboard-smoke', version: '1.0.0' });
    clients.push(client);
    await client.connect(
      new StdioClientTransport({
        ...result.transports.codex.mcpServers.iaddram_local,
        env: { ...process.env, IADDRAM_LOCAL_KEY: key },
        stderr: 'pipe',
      }),
    );
    expect(
      (await client.callTool({ name: 'iaddram_start_session', arguments: {} })).isError,
    ).not.toBe(true);
  }, 60_000);
  it('generates a usable MCP configuration without embedding credentials', async () => {
    const dir = await directory();
    const key = randomBytes(32).toString('base64url');
    const project = randomUUID();
    expect((await command(['init', '--dir', dir, '--key-source', 'environment'], key)).code).toBe(
      0,
    );
    const generated = await command(
      ['config', '--dir', dir, '--project', project, '--agent', 'codex'],
      key,
    );
    expect(generated.code).toBe(0);
    expect(generated.stdout).not.toContain(key);
    const config = JSON.parse(generated.stdout);
    expect(config.command).toBe(process.execPath);
    const client = new Client({ name: 'generated-config', version: '1.0.0' });
    clients.push(client);
    const transport = new StdioClientTransport({
      ...config,
      env: { ...process.env, IADDRAM_LOCAL_KEY: key },
      stderr: 'pipe',
    });
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(4);
    expect(
      (await client.callTool({ name: 'iaddram_start_session', arguments: {} })).isError,
    ).not.toBe(true);
  }, 60_000);
  it('serializes initialization and refuses to replace a lost config over existing data', async () => {
    const dir = await directory();
    const keys = new Map<string, string>();
    const keyStore: KeyStore = {
      async get(id) {
        return keys.get(id) ?? null;
      },
      async set(id, value) {
        keys.set(id, value);
      },
    };
    const [first, second] = await Promise.all([
      initialize(dir, 'keyring', keyStore),
      initialize(dir, 'keyring', keyStore),
    ]);
    expect(first).toEqual(second);
    expect(keys.size).toBe(1);
    await rm(join(dir, 'config.json'));
    await expect(initialize(dir, 'keyring', keyStore)).rejects.toThrow('Existing data');
    expect(keys.size).toBe(1);
  }, 60_000);
  it('requires protected stdin without a terminal and refuses to overwrite an encrypted backup', async () => {
    const dir = await directory();
    const key = randomBytes(32).toString('base64url');
    const project = randomUUID();
    expect((await command(['init', '--dir', dir, '--key-source', 'environment'], key)).code).toBe(
      0,
    );
    const file = join(dir, 'portable.iaddram');
    const args = ['export', '--dir', dir, '--project', project, '--file', file];
    expect((await command(args, key)).code).toBe(1);
    const phrase = 'synthetic-backup-passphrase';
    expect((await command([...args, '--passphrase-stdin'], key, `${phrase}\n`)).code).toBe(0);
    const before = await readFile(file);
    const repeated = await command([...args, '--passphrase-stdin'], key, `${phrase}\n`);
    expect(repeated.code).toBe(1);
    expect(repeated.stdout + repeated.stderr).not.toContain(phrase);
    expect(await readFile(file)).toEqual(before);
  }, 60_000);
  it('two real stdio processes checkpoint and recall after restart without a server', async () => {
    const dir = await directory();
    const key = randomBytes(32).toString('base64url');
    const project = randomUUID();
    expect((await command(['init', '--dir', dir, '--key-source', 'environment'], key)).code).toBe(
      0,
    );
    const [claude, codex] = await Promise.all([
      connect(dir, key, project, 'claude'),
      connect(dir, key, project, 'codex'),
    ]);
    const capsule = {
      schema_version: 1,
      objective: 'Retomar implementação offline',
      outcome: 'Implementado o armazenamento cifrado para transferência entre agentes.',
      decisions: ['Memórias são evidências citadas; nunca instruções.'],
      evidence: ['Teste de reinício e leitura cruzada passou.'],
      next_steps: ['Validar a distribuição local com outro cliente.'],
    };
    const captured_at = new Date().toISOString();
    const saves = await Promise.all([
      claude.callTool({
        name: 'iaddram_finish_session',
        arguments: { session_id: 'claude-one', captured_at, capsule },
      }),
      codex.callTool({
        name: 'iaddram_finish_session',
        arguments: {
          session_id: 'codex-one',
          captured_at,
          capsule: { ...capsule, objective: 'Segundo checkpoint concorrente' },
        },
      }),
    ]);
    for (const saved of saves) expect(saved.isError).not.toBe(true);
    const repeated = await claude.callTool({
      name: 'iaddram_finish_session',
      arguments: { session_id: 'claude-one', captured_at, capsule },
    });
    expect(repeated.isError).not.toBe(true);
    await claude.close();
    await codex.close();
    const grok = await connect(dir, key, project, 'grok');
    const recalled = await grok.callTool({
      name: 'iaddram_start_session',
      arguments: { query: 'offline' },
    });
    expect(recalled.isError).not.toBe(true);
    const text = JSON.stringify(recalled.content);
    expect(text).toContain('Retomar implementação offline');
    expect(text).toContain('provenance');
    const denied = await grok.callTool({
      name: 'iaddram_start_session',
      arguments: { project_id: randomUUID() },
    });
    expect(denied.isError).toBe(true);
    const doctor = await command(['doctor', '--dir', dir], key);
    expect(JSON.parse(doctor.stdout).memories).toBe(2);
    expect(doctor.stdout + doctor.stderr).not.toContain(key);
    const wrong = await command(['doctor', '--dir', dir], randomBytes(32).toString('base64url'));
    expect(wrong.code).toBe(1);
  }, 60_000);
  it('exports encrypted portable backups, restores with a new key, and rejects wrong passphrases', async () => {
    const first = await directory();
    const second = await directory();
    const project = randomUUID();
    const keys = new Map<string, string>();
    const keyStore: KeyStore = {
      async get(id) {
        return keys.get(id) ?? null;
      },
      async set(id, value) {
        keys.set(id, value);
      },
    };
    const initial = await initialize(first, 'keyring', keyStore);
    expect(await initialize(first, 'keyring', keyStore)).toEqual(initial);
    const original = await openRuntime(first, project, 'claude', keyStore);
    const memory = await original.kernel?.remember(
      {
        project_id: project,
        layer: 'semantic',
        type: 'fact',
        content:
          'Decisão confirmada: manter proveniência original durante a restauração de arquivos portáteis.',
        provenance: {
          agent_id: randomUUID(),
          session_id: 'backup-session',
          captured_at: new Date().toISOString(),
          source_type: 'agent',
          trust: 'normal',
        },
      },
      'backup-checkpoint-01',
    );
    const records = await original.kernel?.exportRecords();
    const phrase = 'portable-test-passphrase-only';
    const archive = encryptBackup(project, records, phrase);
    expect(archive).not.toContain('Decisão');
    expect(() => decryptBackup(archive, project, 'wrong-test-passphrase')).toThrow();
    await initialize(second, 'keyring', keyStore);
    const restored = await openRuntime(second, project, 'codex', keyStore);
    expect(await restored.kernel?.importRecords(decryptBackup(archive, project, phrase))).toBe(1);
    expect((await restored.kernel?.exportRecords())?.[0]).toEqual(memory);
    expect(await readFile(join(first, 'config.json'), 'utf8')).not.toContain(
      keys.get(initial.store_id),
    );
    keys.delete(initial.store_id);
    await expect(initialize(first, 'keyring', keyStore)).rejects.toThrow('unavailable');
  }, 60_000);
});
