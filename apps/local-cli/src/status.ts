import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { manifestSchema, readRegular } from './onboard.js';
import { openRuntime } from './runtime.js';

async function exists(path: string) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

/** Project diagnosis only: never asserts that the caller's MCP client is configured. */
export async function projectStatus(options: {
  path: string;
  directory: string;
  agent: string;
  edition?: 'local' | undefined;
}) {
  const base = {
    schema_version: 1,
    checked_at: new Date().toISOString(),
    mcp_client_verified: false,
    usage_measured: false,
  };
  try {
    const root = await realpath(options.path);
    const local = await readRegular(join(root, '.iaddram-local.json'));
    const server = await exists(join(root, '.iaddram.json'));
    if (server && local !== undefined && !options.edition)
      return {
        ...base,
        status: 'edition_required',
        local_manifest_present: true,
        server_manifest_present: true,
      };
    if (local === undefined)
      return {
        ...base,
        status: server ? 'server_check_required' : 'not_adopted',
        server_manifest_present: server,
        note: server
          ? 'Use the existing Server workflow and current agent credentials; do not onboard Local automatically.'
          : 'No Local or Server manifest found.',
      };
    const manifest = manifestSchema.parse(JSON.parse(local));
    // Never initialize or replace keys during diagnosis. Missing data is unavailable, not empty.
    if (!(await exists(join(options.directory, 'data'))))
      return {
        ...base,
        status: 'unavailable',
        project_id: manifest.project_id,
        reason: 'storage_missing',
      };
    const runtime = await openRuntime(options.directory, manifest.project_id, options.agent);
    if (!runtime.kernel) throw new Error('Project kernel unavailable.');
    await runtime.store.doctor();
    const records = await runtime.kernel.exportRecords();
    const capsules = records.filter(
      (record) =>
        record.layer === 'worklog' &&
        record.type === 'procedure' &&
        record.tags.includes('competence-capsule-v1') &&
        record.content.startsWith('# Cápsula de competência IADDRAM v1'),
    );
    capsules.sort((a, b) => Date.parse(b.valid_from) - Date.parse(a.valid_from));
    const latest = capsules[0];
    return {
      ...base,
      edition: 'local',
      project_id: manifest.project_id,
      status: latest ? 'ready_to_resume' : 'no_capsule',
      storage_accessible: true,
      memories: records.length,
      capsules: capsules.length,
      latest_capsule: latest
        ? {
            id: latest.id,
            saved_at: latest.valid_from,
            captured_at: latest.provenance.captured_at,
            agent_id: latest.provenance.agent_id,
            age_seconds: Math.max(
              0,
              Math.floor((Date.now() - Date.parse(latest.valid_from)) / 1000),
            ),
          }
        : null,
      next_step:
        'Verify iaddram_local in the current client, call iaddram_start_session and compare evidence with current Git and documents. Storage readiness does not prove client connection or semantic correctness.',
    };
  } catch {
    // Never echo parsers, database errors, credentials or recovered memory content.
    return { ...base, status: 'unavailable', reason: 'manifest_key_or_storage_check_failed' };
  }
}
