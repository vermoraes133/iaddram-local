#!/usr/bin/env node
import { readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { decryptBackup, encryptBackup } from './backup.js';
import { createLocalMcp } from './mcp.js';
import { onboard } from './onboard.js';
import { readPassphrase } from './passphrase.js';
import { initialize, localDirectory, openRuntime, readConfig, stableId } from './runtime.js';
import { projectStatus } from './status.js';

process.umask(0o077);
async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: 'string' },
      path: { type: 'string' },
      edition: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      project: { type: 'string' },
      agent: { type: 'string', default: 'local' },
      name: { type: 'string' },
      file: { type: 'string' },
      id: { type: 'string' },
      'key-source': { type: 'string', default: 'keyring' },
      'passphrase-stdin': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (positionals.length > 1) throw new Error('Unexpected arguments.');
  const command = values.help ? 'help' : (positionals[0] ?? 'help');
  const directory = localDirectory(values.dir);
  if (command === 'help') {
    console.log('status [--path PROJECT-DIR] [--edition local] [--dir STORAGE-DIR] [--agent NAME]');
    console.log(
      'IADDRAM Local 0.1.0\ninit | doctor | onboard [--path PROJECT-DIR] [--name NAME] [--project UUID] [--dry-run] | project --name NAME | config --project UUID --agent NAME | mcp --project UUID --agent NAME | export/import --project UUID --file PATH [--passphrase-stdin] | delete --project UUID --id UUID\nOptions: --dir PATH; init --key-source keyring|environment\nMade with ☕ by Mestre dos Cabos',
    );
    return;
  }
  if (command === 'status') {
    const result = await projectStatus({
      path: values.path ?? process.cwd(),
      directory,
      agent: values.agent,
      edition: z.literal('local').optional().parse(values.edition),
    });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = ['ready_to_resume', 'no_capsule'].includes(result.status) ? 0 : 2;
    return;
  }
  if (command === 'onboard') {
    console.log(
      JSON.stringify(
        await onboard({
          directory,
          path: values.path ?? process.cwd(),
          cli: fileURLToPath(import.meta.url),
          name: values.name,
          project: values.project,
          dryRun: values['dry-run'],
        }),
        null,
        2,
      ),
    );
    return;
  }
  if (command === 'init') {
    const source = z.enum(['keyring', 'environment']).parse(values['key-source']);
    const config = await initialize(directory, source);
    console.log(
      JSON.stringify({ status: 'initialized', directory, key_source: config.key_source }),
    );
    return;
  }
  if (command === 'project') {
    const config = await readConfig(directory);
    const name = z.string().trim().min(1).max(100).parse(values.name);
    console.log(
      JSON.stringify({
        project_name: name,
        project_id: stableId(`${config.store_id}:project:${name}`),
      }),
    );
    return;
  }
  if (command === 'config') {
    await readConfig(directory);
    const projectId = z.uuid().parse(values.project);
    const agent = z.string().trim().min(1).max(100).parse(values.agent);
    console.log(
      JSON.stringify(
        {
          command: process.execPath,
          args: [
            fileURLToPath(import.meta.url),
            'mcp',
            '--dir',
            directory,
            '--project',
            projectId,
            '--agent',
            agent,
          ],
        },
        null,
        2,
      ),
    );
    return;
  }
  if (!['doctor', 'mcp', 'export', 'import', 'delete'].includes(command))
    throw new Error('Unknown command. Run help.');
  const projectId = command === 'doctor' ? undefined : z.uuid().parse(values.project);
  const runtime = await openRuntime(directory, projectId, values.agent);
  if (command === 'doctor') {
    console.log(JSON.stringify(await runtime.store.doctor()));
    return;
  }
  const kernel = runtime.kernel;
  if (!kernel || !projectId) throw new Error('Project required.');
  if (command === 'mcp') {
    await runtime.store.doctor();
    const server = createLocalMcp(kernel, projectId, runtime.agentId);
    await server.connect(new StdioServerTransport());
    return;
  }
  if (command === 'delete') {
    console.log(JSON.stringify({ deleted: await kernel.remove(z.uuid().parse(values.id)) }));
    return;
  }
  const path = z.string().min(1).parse(values.file);
  const phrase = await readPassphrase(values['passphrase-stdin'], command === 'export');
  if (command === 'export') {
    const archive = encryptBackup(projectId, await kernel.exportRecords(), phrase);
    if (Buffer.byteLength(archive, 'utf8') > 64 * 1024 * 1024)
      throw new Error('Backup exceeds 64 MiB.');
    await writeFile(path, archive, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ status: 'exported', file: path }));
  } else {
    if ((await stat(path)).size > 64 * 1024 * 1024) throw new Error('Backup exceeds 64 MiB.');
    const records = decryptBackup(await readFile(path, 'utf8'), projectId, phrase);
    console.log(
      JSON.stringify({ status: 'imported', memories: await kernel.importRecords(records) }),
    );
  }
}
main().catch(() => {
  // Native keyring/SQL/parser errors may contain input values. Never echo them to a client or log.
  console.error(
    'IADDRAM Local failed. Check command arguments, initialization, keyring access and backup passphrase. Run help for usage.',
  );
  process.exitCode = 1;
});
