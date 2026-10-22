import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Entry } from '@napi-rs/keyring';
import { initialize, openRuntime } from '../dist/runtime.js';

// Opt-in integration smoke: invokes the installed Claude client using synthetic memory only.
const directory = await mkdtemp(join(tmpdir(), 'iaddram-claude-smoke-'));
const project = randomUUID();
const marker = `LOCAL_${randomUUID().replaceAll('-', '')}`;
let account;
try {
  const config = await initialize(directory);
  account = config.store_id;
  const runtime = await openRuntime(directory, project, 'fixture');
  await runtime.kernel.remember(
    {
      project_id: project,
      layer: 'semantic',
      type: 'fact',
      content: `Decisão verificada em teste: o código de retomada deste projeto sintético é ${marker}. Esta evidência existe somente para validar recuperação pelo cliente MCP.`,
      provenance: {
        agent_id: runtime.agentId,
        source_type: 'agent',
        trust: 'normal',
        session_id: 'local-client-smoke',
        captured_at: new Date().toISOString(),
      },
    },
    'local-client-smoke-0001',
  );
  const mcp = {
    mcpServers: {
      iaddram_local: {
        command: process.execPath,
        args: [
          fileURLToPath(new URL('../dist/cli.js', import.meta.url)),
          'mcp',
          '--dir',
          directory,
          '--project',
          project,
          '--agent',
          'claude',
        ],
      },
    },
  };
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      [
        '-p',
        '--strict-mcp-config',
        '--mcp-config',
        JSON.stringify(mcp),
        '--setting-sources',
        '',
        '--tools',
        '',
        '--allowedTools',
        'mcp__iaddram_local__iaddram_start_session',
        '--permission-mode',
        'dontAsk',
        '--disable-slash-commands',
        '--no-session-persistence',
        '--output-format',
        'stream-json',
        '--verbose',
        '--effort',
        'low',
        '--max-budget-usd',
        '1',
        'Use iaddram_start_session para recuperar o código de retomada do projeto. Responda somente com o código encontrado na memória. Não use outros recursos.',
      ],
      { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, 90_000);
    child.stdout.on('data', (data) => {
      output += data;
      if (output.length > 2_000_000) child.kill('SIGTERM');
    });
    // Provider diagnostics may contain private account information; consume without recording.
    child.stderr.resume();
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, output, timedOut });
    });
  });
  const events = result.output.split('\n').flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const called = events.some(
    (event) =>
      event.type === 'assistant' &&
      event.message?.content?.some(
        (block) =>
          block.type === 'tool_use' && block.name === 'mcp__iaddram_local__iaddram_start_session',
      ),
  );
  const found = events.some(
    (event) => event.type === 'result' && !event.is_error && event.result?.includes(marker),
  );
  const passed = result.code === 0 && called && found;
  console.log(
    JSON.stringify({
      client: 'claude',
      passed,
      tool_called: called,
      marker_verified: found,
      timed_out: result.timedOut,
      exit: result.code,
    }),
  );
  if (!passed) process.exitCode = 1;
} finally {
  try {
    if (account) new Entry('iaddram-local', account).deletePassword();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
