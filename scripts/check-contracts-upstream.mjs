// Compara packages/contracts/src com a origem no IADDRAM Server.
// Uso: node scripts/check-contracts-upstream.mjs <checkout-do-server> [ref]
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const [serverDir, ref = 'main'] = process.argv.slice(2);
if (!serverDir) {
  console.error('uso: node scripts/check-contracts-upstream.mjs <checkout-do-server> [ref]');
  process.exit(2);
}

const upstream = await readFile(join(root, 'packages/contracts/UPSTREAM.md'), 'utf8');
const origin = upstream.match(/Commit de origem \| `([0-9a-f]{40})`/)?.[1];
if (!origin) throw new Error('UPSTREAM.md sem commit de origem');

const git = (...args) =>
  execFileSync('git', ['-C', resolve(serverDir), ...args], { encoding: 'utf8' });

const localDir = join(root, 'packages/contracts/src');
const local = new Set(await readdir(localDir));
const remote = new Set(
  git('ls-tree', '--name-only', `${ref}:packages/contracts/src`).trim().split('\n'),
);

const diverged = [];
for (const name of new Set([...local, ...remote])) {
  if (!local.has(name)) diverged.push(`só no Server: ${name}`);
  else if (!remote.has(name)) diverged.push(`só no Local: ${name}`);
  else {
    const theirs = git('show', `${ref}:packages/contracts/src/${name}`);
    const ours = await readFile(join(localDir, name), 'utf8');
    if (theirs !== ours) diverged.push(`diferente: ${name}`);
  }
}

const later = git('log', '--oneline', `${origin}..${ref}`, '--', 'packages/contracts').trim();

console.log(`origem registrada: ${origin.slice(0, 12)} | comparado com: ${ref}`);
console.log(later ? `commits do Server depois da origem:\n${later}` : 'nenhum commit novo no Server');
console.log(diverged.length ? `divergências:\n${diverged.join('\n')}` : 'src idêntico');
process.exit(diverged.length ? 1 : 0);
