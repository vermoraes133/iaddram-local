import { copyFile, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputRoot = resolve(root, 'dist');
await mkdir(outputRoot, { recursive: true });
const release = await mkdtemp(join(outputRoot, 'local-release-'));
const bundle = join(release, 'package');
await mkdir(bundle);

const built = await build({
  entryPoints: [join(root, 'apps/local-cli/src/cli.ts')],
  outfile: join(bundle, 'dist/cli.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: false,
  metafile: true,
  external: ['@electric-sql/pglite', '@napi-rs/keyring', 'proper-lockfile'],
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  logLevel: 'silent',
});
const notices = new Map();
for (const input of Object.keys(built.metafile.inputs)) {
  if (!input.includes('node_modules/')) continue;
  let directory = dirname(resolve(root, input));
  while (directory !== dirname(directory)) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    if (manifest?.name && manifest?.version) {
      const id = `${manifest.name}@${manifest.version}`;
      if (!notices.has(id)) {
        const files = (await readdir(directory)).filter((name) =>
          /^(?:licen[sc]e|notice)(?:[.-]|$)/iu.test(name),
        );
        if (!files.length) throw new Error(`Missing license for bundled dependency ${id}`);
        notices.set(
          id,
          `${id}\n${(await Promise.all(files.map((file) => readFile(join(directory, file), 'utf8')))).join('\n')}`,
        );
      }
      break;
    }
    directory = dirname(directory);
  }
}
await writeFile(join(bundle, 'THIRD_PARTY_NOTICES.txt'), [...notices.values()].join('\n\n'));
const dependencies = JSON.parse(
  await readFile(join(root, 'apps/local-cli/package.json'), 'utf8'),
).dependencies;
const storage = JSON.parse(
  await readFile(join(root, 'packages/storage-pglite/package.json'), 'utf8'),
).dependencies;
await writeFile(
  join(bundle, 'package.json'),
  JSON.stringify(
    {
      name: 'iaddram-local',
      version: JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version,
      private: true,
      description: 'Encrypted local memory shared by AI agents through MCP',
      license: 'Apache-2.0',
      type: 'module',
      engines: { node: '>=22 <25' },
      bin: { iaddram: 'dist/cli.js' },
      files: ['dist', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt', 'README.md', 'SECURITY.md'],
      dependencies: {
        '@electric-sql/pglite': storage['@electric-sql/pglite'],
        '@napi-rs/keyring': dependencies['@napi-rs/keyring'],
        'proper-lockfile': dependencies['proper-lockfile'],
      },
    },
    null,
    2,
  ),
);
for (const file of ['README.md', 'LICENSE', 'NOTICE', 'SECURITY.md', 'CONTRIBUTING.md']) {
  await copyFile(join(root, file), join(bundle, file));
}
console.log(JSON.stringify({ status: 'prepared', release, package: bundle, published: false }));
