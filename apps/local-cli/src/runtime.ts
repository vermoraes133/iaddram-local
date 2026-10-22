import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { MemoryEnvelopeCipher, MemoryKernel } from '@iaddram/memory-kernel';
import { PgliteMemoryStore } from '@iaddram/storage-pglite';
import lockfile from 'proper-lockfile';
import { z } from 'zod';

const configSchema = z
  .object({
    version: z.literal(1),
    store_id: z.uuid(),
    key_source: z.enum(['keyring', 'environment']),
  })
  .strict();
export type LocalConfig = z.infer<typeof configSchema>;
export interface KeyStore {
  get(account: string): Promise<string | null>;
  set(account: string, value: string): Promise<void>;
}
export class NativeKeyStore implements KeyStore {
  async get(account: string) {
    const { Entry } = await import('@napi-rs/keyring');
    return new Entry('iaddram-local', account).getPassword();
  }
  async set(account: string, value: string) {
    const { Entry } = await import('@napi-rs/keyring');
    new Entry('iaddram-local', account).setPassword(value);
  }
}
export function localDirectory(directory?: string): string {
  return resolve(directory ?? join(homedir(), '.iaddram'));
}
export function stableId(value: string): string {
  const hex = createHash('sha256').update(value).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export async function readConfig(directory: string): Promise<LocalConfig> {
  return configSchema.parse(JSON.parse(await readFile(join(directory, 'config.json'), 'utf8')));
}
export async function initialize(
  directory: string,
  source: LocalConfig['key_source'] = 'keyring',
  keys: KeyStore = new NativeKeyStore(),
): Promise<LocalConfig> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  directory = await realpath(directory);
  await chmod(directory, 0o700);
  const release = await lockfile.lock(join(directory, 'config.json'), {
    realpath: false,
    retries: 20,
  });
  try {
    return await initializeLocked(directory, source, keys);
  } finally {
    await release();
  }
}

async function initializeLocked(
  directory: string,
  source: LocalConfig['key_source'],
  keys: KeyStore,
): Promise<LocalConfig> {
  let existing: LocalConfig | undefined;
  try {
    existing = await readConfig(directory);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  if (existing) {
    const runtime = await openRuntime(directory, undefined, 'local', keys);
    await runtime.store.doctor();
    return existing;
  }
  // Lost config must not create a replacement key over an existing data directory.
  try {
    await stat(join(directory, 'data'));
    throw new Error('Existing data without configuration. Restore original config and key.');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const config: LocalConfig = { version: 1, store_id: randomUUID(), key_source: source };
  if (source === 'keyring') await keys.set(config.store_id, randomBytes(32).toString('base64url'));
  else new MemoryEnvelopeCipher(environmentKey());
  await writeFile(join(directory, 'config.json'), JSON.stringify(config, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  const runtime = await openRuntime(directory, undefined, 'local', keys);
  await runtime.store.doctor();
  return config;
}
function environmentKey(): string {
  const key = process.env.IADDRAM_LOCAL_KEY;
  if (!key)
    throw new Error('IADDRAM_LOCAL_KEY is missing. Inject the original key from a secret manager.');
  return key;
}
export async function openRuntime(
  directory: string,
  projectId?: string,
  agent = 'local',
  keys: KeyStore = new NativeKeyStore(),
) {
  const config = await readConfig(directory);
  const key =
    config.key_source === 'environment' ? environmentKey() : await keys.get(config.store_id);
  if (!key)
    throw new Error(
      'Local key unavailable in OS keyring. Unlock the keyring or restore a portable backup.',
    );
  const cipher = new MemoryEnvelopeCipher(key);
  const store = new PgliteMemoryStore(directory, cipher);
  const agentId = stableId(
    `iaddram-local:agent:${config.store_id}:${z.string().min(1).max(100).parse(agent)}`,
  );
  return {
    config,
    store,
    cipher,
    agentId,
    kernel: projectId ? new MemoryKernel(store, cipher, agentId, projectId) : undefined,
  };
}
