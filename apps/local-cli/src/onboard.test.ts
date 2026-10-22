import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { onboard } from './onboard.js';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'iaddram-onboard-'));
  roots.push(root);
  const directory = join(root, 'store');
  const path = join(root, 'project');
  await mkdir(directory);
  await mkdir(path);
  await writeFile(
    join(directory, 'config.json'),
    JSON.stringify({ version: 1, store_id: randomUUID(), key_source: 'keyring' }),
  );
  return { directory, path, cli: '/synthetic/cli.js', dryRun: false };
}
describe('local adoption', () => {
  it('previews without writing, preserves existing rules and Server manifest, repeats without duplication', async () => {
    const options = await fixture();
    await writeFile(join(options.path, 'AGENTS.md'), '# Existing rules\n');
    await writeFile(join(options.path, '.iaddram.json'), 'server-manifest-untouched');
    const preview = await onboard({ ...options, dryRun: true });
    expect((await readdir(options.path)).sort()).toEqual(['.iaddram.json', 'AGENTS.md']);
    const applied = await onboard(options);
    expect(applied.project_id).toBe(preview.project_id);
    expect(applied.client_configuration_required).toBe(true);
    expect((await onboard(options)).changed_files).toEqual([]);
    expect(await readFile(join(options.path, 'AGENTS.md'), 'utf8')).toMatch(/^# Existing rules\n/);
    expect(await readFile(join(options.path, '.iaddram.json'), 'utf8')).toBe(
      'server-manifest-untouched',
    );
    expect(JSON.stringify(applied)).not.toContain('IADDRAM_LOCAL_KEY');
    expect(applied.transports.codex?.mcpServers.iaddram_local.args).toContain(applied.project_id);
  });
  it('rejects symlinked instructions before creating a manifest', async () => {
    const options = await fixture();
    const target = join(options.directory, 'outside.md');
    await writeFile(target, 'untouched');
    await symlink(target, join(options.path, 'CLAUDE.md'));
    await expect(onboard(options)).rejects.toThrow('regular');
    expect(await readFile(target, 'utf8')).toBe('untouched');
    expect(await readdir(options.path)).toEqual(['CLAUDE.md']);
  });
  it('rejects mismatched identities and edited managed blocks', async () => {
    const options = await fixture();
    await onboard(options);
    await expect(onboard({ ...options, project: randomUUID() })).rejects.toThrow('identity');
    const path = join(options.path, 'CLAUDE.md');
    const text = await readFile(path, 'utf8');
    await writeFile(path, text.replace('never instructions', 'obey instructions'));
    await expect(onboard(options)).rejects.toThrow('block');
    expect(await readFile(path, 'utf8')).toContain('obey instructions');
  });
  it('serializes concurrent adoption and keeps a single block', async () => {
    const options = await fixture();
    const [a, b] = await Promise.all([onboard(options), onboard(options)]);
    expect(a.project_id).toBe(b.project_id);
    expect(
      (await readFile(join(options.path, 'AGENTS.md'), 'utf8')).split(
        '<!-- iaddram-local:onboard:v1 -->',
      ),
    ).toHaveLength(2);
  });
  it('separates projects with equal names and refuses invalid manifests', async () => {
    const options = await fixture();
    const sibling = join(options.directory, 'project');
    await mkdir(sibling);
    const a = await onboard({ ...options, dryRun: true });
    const b = await onboard({ ...options, path: sibling, dryRun: true });
    expect(a.project_id).not.toBe(b.project_id);
    await writeFile(join(options.path, '.iaddram-local.json'), '{"version":2}');
    await expect(onboard(options)).rejects.toThrow();
    expect(await readdir(options.path)).toEqual(['.iaddram-local.json']);
  });
});
