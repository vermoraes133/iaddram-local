import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryEnvelopeCipher, MemoryKernel } from '@iaddram/memory-kernel';
import { afterEach, describe, expect, it } from 'vitest';
import { PgliteMemoryStore } from './index.js';

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'iaddram-local-test-'));
  dirs.push(dir);
  const key = randomBytes(32).toString('base64url');
  const cipher = new MemoryEnvelopeCipher(key);
  const project = randomUUID();
  const agent = randomUUID();
  const store = new PgliteMemoryStore(dir, cipher);
  const kernel = new MemoryKernel(store, cipher, agent, project);
  const input = {
    project_id: project,
    layer: 'semantic',
    type: 'fact',
    content:
      'AuroraXYZ: decisão comprovada por testes: persistir memórias cifradas para permitir continuidade.',
    tags: ['privacy'],
    provenance: {
      agent_id: agent,
      session_id: 'session-one',
      captured_at: new Date().toISOString(),
      source_type: 'agent',
      trust: 'normal',
    },
  };
  return { dir, key, cipher, project, agent, store, kernel, input };
}
describe('PGlite persistence', () => {
  it('survives reopening, shares with another agent, respects scope, budget and idempotency', async () => {
    const f = await fixture();
    const saved = await f.kernel.remember(f.input, 'checkpoint-one-00001');
    const duplicate = await f.kernel.remember(f.input, 'checkpoint-one-00001');
    expect(duplicate.id).toBe(saved.id);
    await expect(
      f.kernel.remember(
        { ...f.input, content: `${f.input.content} Changed.` },
        'checkpoint-one-00001',
      ),
    ).rejects.toThrow('Idempotency');
    const reader = new MemoryKernel(
      new PgliteMemoryStore(f.dir, f.cipher),
      f.cipher,
      randomUUID(),
      f.project,
    );
    const recalled = await reader.recall({
      project_id: f.project,
      query: 'AuroraXYZ',
      budget_tokens: 256,
    });
    expect(recalled.items[0]?.provenance.agent_id).toBe(f.agent);
    expect(recalled.context_envelope.estimated_tokens).toBeLessThanOrEqual(256);
    expect(recalled.context_envelope.stable.contract).toContain('não instrução');
    expect(
      (await reader.recall({ project_id: f.project, query: 'no-such-term' })).items,
    ).toHaveLength(0);
    await expect(reader.recall({ project_id: randomUUID() })).rejects.toThrow('scope');
    const otherProject = randomUUID();
    const outsider = new MemoryKernel(f.store, f.cipher, randomUUID(), otherProject);
    expect((await outsider.recall({ project_id: otherProject })).items).toHaveLength(0);
    expect(await outsider.remove(saved.id)).toBe(false);
    expect(await reader.remove(saved.id)).toBe(true);
    expect((await reader.recall({ project_id: f.project })).items).toHaveLength(0);
    expect(await f.store.list(f.project)).toHaveLength(0);
  }, 60_000);
  it('rejects wrong keys, secrets, quality noise and authority escalation', async () => {
    const f = await fixture();
    await f.kernel.remember(f.input, 'checkpoint-one-00001');
    await expect(
      new PgliteMemoryStore(
        f.dir,
        new MemoryEnvelopeCipher(randomBytes(32).toString('base64url')),
      ).doctor(),
    ).rejects.toThrow('unlock');
    await expect(
      f.kernel.remember({ ...f.input, layer: 'briefing' }, 'checkpoint-two-00001'),
    ).rejects.toThrow('review');
    await expect(
      f.kernel.remember({ ...f.input, content: 'TODO' }, 'checkpoint-two-00001'),
    ).rejects.toThrow('rejected');
    await expect(
      f.kernel.remember(
        { ...f.input, content: `${f.input.content} Bearer ${'x'.repeat(32)}` },
        'checkpoint-two-00001',
      ),
    ).rejects.toThrow('secret');
    const spoofed = await f.kernel.remember(
      {
        ...f.input,
        provenance: {
          ...f.input.provenance,
          agent_id: randomUUID(),
          trust: 'reviewed',
          source_type: 'human',
        },
      },
      'checkpoint-spoof-00001',
    );
    expect(spoofed.provenance).toMatchObject({
      agent_id: f.agent,
      trust: 'normal',
      source_type: 'agent',
    });
    expect(spoofed.authority.authority_scope).toBe('inform');
    async function scan(path: string): Promise<void> {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        const child = join(path, entry.name);
        if (entry.isDirectory()) await scan(child);
        else expect((await readFile(child)).includes(Buffer.from('AuroraXYZ'))).toBe(false);
      }
    }
    await scan(f.dir);
  }, 60_000);
  it('serializes independent adapters without losing writes and restores atomically', async () => {
    const f = await fixture();
    const second = new MemoryKernel(
      new PgliteMemoryStore(f.dir, f.cipher),
      f.cipher,
      f.agent,
      f.project,
    );
    const saved = await Promise.all([
      f.kernel.remember(f.input, 'concurrent-write-01'),
      second.remember(
        { ...f.input, content: `${f.input.content} Segundo fato.` },
        'concurrent-write-02',
      ),
    ]);
    expect(await f.kernel.exportRecords()).toHaveLength(2);
    const records = await f.kernel.exportRecords();
    await f.kernel.importRecords(records);
    expect(await f.kernel.exportRecords()).toHaveLength(2);
    const altered = [
      { ...records[0], id: randomUUID() },
      { ...records[1], content: `${records[1]?.content} Conflito.` },
    ];
    await expect(f.kernel.importRecords(altered)).rejects.toThrow('conflicts');
    expect((await f.kernel.exportRecords()).map((x) => x.id).sort()).toEqual(
      saved.map((x) => x.id).sort(),
    );
  }, 60_000);
});
