import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { onboard } from './onboard.js';
import { initialize, openRuntime } from './runtime.js';
import { projectStatus } from './status.js';

const roots: string[] = [];
const originalKey = process.env.IADDRAM_LOCAL_KEY;
afterEach(async () => {
  if (originalKey === undefined) delete process.env.IADDRAM_LOCAL_KEY;
  else process.env.IADDRAM_LOCAL_KEY = originalKey;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'iaddram-status-'));
  roots.push(root);
  const path = join(root, 'project');
  await mkdir(path);
  return { path, directory: join(root, 'store'), agent: 'codex' };
}
describe('project status', () => {
  it('distinguishes not adopted and Server without initializing local storage', async () => {
    const options = await fixture();
    expect((await projectStatus(options)).status).toBe('not_adopted');
    await writeFile(join(options.path, '.iaddram.json'), 'not read by Local');
    expect((await projectStatus(options)).status).toBe('server_check_required');
    expect((await readdir(join(options.path, '..'))).sort()).toEqual(['project']);
  });
  it('rejects invalid manifests and requires an edition when both exist', async () => {
    const options = await fixture();
    await writeFile(join(options.path, '.iaddram-local.json'), '{bad json');
    expect((await projectStatus(options)).status).toBe('unavailable');
    await writeFile(join(options.path, '.iaddram.json'), '{}');
    expect((await projectStatus(options)).status).toBe('edition_required');
    expect((await projectStatus({ ...options, edition: 'local' })).status).toBe('unavailable');
  });
  it('detects a capsule across agents, never leaks content, distinguishes empty and wrong key', async () => {
    const options = await fixture();
    process.env.IADDRAM_LOCAL_KEY = randomBytes(32).toString('base64url');
    await initialize(options.directory, 'environment');
    const adoption = await onboard({ ...options, cli: '/synthetic/cli.js', dryRun: false });
    expect((await projectStatus(options)).status).toBe('no_capsule');
    const runtime = await openRuntime(options.directory, adoption.project_id, 'claude');
    if (!runtime.kernel) throw new Error('Project kernel unavailable.');
    await runtime.kernel.remember(
      {
        project_id: adoption.project_id,
        layer: 'worklog',
        type: 'procedure',
        content:
          '# Cápsula de competência IADDRAM v1\n## Objetivo\nPermitir que outro agente retome a migração do armazenamento com segurança.\n## Resultado\nDecisão: preservar a identidade do projeto na migração. Evidência: teste de restauração validou os registros. Próximo passo: validar o cliente. private-content-marker\n## Procedimentos\nCriar backup cifrado, restaurar em diretório isolado e conferir identidades e proveniência antes de substituir qualquer configuração.\n## Restrições\nNão apagar o armazenamento original nem rotacionar chaves durante o diagnóstico.\n## Evidências\nO arquivo src/storage.ts contém a implementação e a suíte de integração confirmou a leitura cruzada entre agentes.',
        tags: ['competence-capsule-v1'],
        provenance: {
          agent_id: runtime.agentId,
          session_id: 'synthetic-session',
          captured_at: new Date().toISOString(),
          source_type: 'agent',
          trust: 'normal',
        },
      },
      'status-capsule-0001',
    );
    const report = await projectStatus(options);
    expect(report.status).toBe('ready_to_resume');
    expect(report.mcp_client_verified).toBe(false);
    expect(report.usage_measured).toBe(false);
    expect(JSON.stringify(report)).not.toContain('private-content-marker');
    expect('latest_capsule' in report && report.latest_capsule?.agent_id).toBe(runtime.agentId);
    const config = await readFile(join(options.directory, 'config.json'), 'utf8');
    process.env.IADDRAM_LOCAL_KEY = randomBytes(32).toString('base64url');
    expect((await projectStatus(options)).status).toBe('unavailable');
    expect(await readFile(join(options.directory, 'config.json'), 'utf8')).toBe(config);
  }, 60_000);
});
