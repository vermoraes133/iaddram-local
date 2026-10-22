import { chmod, mkdir, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import {
  decodeEnvelope,
  encodeEnvelope,
  type MemoryEnvelopeCipher,
  type MemoryStore,
  type StoredMemory,
} from '@iaddram/memory-kernel';
import lockfile from 'proper-lockfile';

interface Row {
  id: string;
  project_id: string;
  layer: string;
  envelope: StoredMemory['envelope'];
  tokens: string[];
  request_key: string;
  digest: string;
  created_at: string;
}
const fromRow = (row: Row): StoredMemory => ({
  id: row.id,
  projectId: row.project_id,
  layer: row.layer,
  envelope: row.envelope,
  tokens: row.tokens,
  requestKey: row.request_key,
  digest: row.digest,
  createdAt: row.created_at,
});
const columns = 'id, project_id, layer, envelope, tokens, request_key, digest, created_at';
const insertSql = `insert into local_memories (${columns}) values ($1,$2,$3,$4,$5,$6,$7,$8)`;
const values = (row: StoredMemory) => [
  row.id,
  row.projectId,
  row.layer,
  JSON.stringify(row.envelope),
  row.tokens,
  row.requestKey,
  row.digest,
  row.createdAt,
];

/** Opens/closes under a process lock for each operation so independent MCP clients can share data. */
export class PgliteMemoryStore implements MemoryStore {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly directory: string,
    private readonly cipher: MemoryEnvelopeCipher,
  ) {}

  private async run<T>(operation: (db: PGlite) => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const requested = resolve(this.directory);
      await mkdir(requested, { recursive: true, mode: 0o700 });
      const directory = await realpath(requested);
      await chmod(directory, 0o700);
      const release = await lockfile.lock(directory, {
        stale: 30_000,
        update: 5_000,
        retries: { retries: 100, factor: 1, minTimeout: 100, maxTimeout: 100 },
      });
      let db: PGlite | undefined;
      try {
        db = await PGlite.create(join(directory, 'data'));
        await db.exec(`
          create table if not exists local_meta (key text primary key, value jsonb not null);
          create table if not exists local_memories (
            id uuid primary key, project_id uuid not null, layer text not null,
            envelope jsonb not null, tokens text[] not null, request_key text not null,
            digest text not null, created_at text not null,
            unique(project_id, request_key)
          );
          create index if not exists local_project_time on local_memories(project_id, created_at desc);
          create index if not exists local_search on local_memories using gin(tokens);
        `);
        await this.verifyKey(db);
        return await operation(db);
      } finally {
        try {
          await db?.close();
        } finally {
          await release();
        }
      }
    });
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async verifyKey(db: PGlite) {
    const context = { memoryId: 'key-check', tenantId: 'local', projectId: 'local' };
    const result = await db.query<{ value: unknown }>(
      "select value from local_meta where key = 'key-check'",
    );
    if (result.rows[0]) {
      try {
        if (
          this.cipher.decrypt(decodeEnvelope(result.rows[0].value), context) !== 'iaddram-local-v1'
        )
          throw new Error('Invalid key');
      } catch {
        throw new Error(
          'Unable to unlock local memory. Restore the original key; do not reinitialize.',
        );
      }
    } else {
      const count = await db.query<{ count: number }>(
        'select count(*)::int as count from local_memories',
      );
      if (count.rows[0]?.count !== 0)
        throw new Error('Local key verifier missing from nonempty storage.');
      await db.query("insert into local_meta(key,value) values ('key-check',$1)", [
        JSON.stringify(encodeEnvelope(this.cipher.encrypt('iaddram-local-v1', context))),
      ]);
    }
  }

  async doctor(): Promise<{
    status: 'ok';
    memories: number;
    storage: 'pglite';
    schema_version: 1;
  }> {
    return this.run(async (db) => {
      const result = await db.query<{ count: number }>(
        'select count(*)::int as count from local_memories',
      );
      return {
        status: 'ok',
        memories: result.rows[0]?.count ?? 0,
        storage: 'pglite',
        schema_version: 1,
      };
    });
  }

  async put(row: StoredMemory): Promise<StoredMemory> {
    return this.run((db) =>
      db.transaction(async (tx) => {
        const previous = await tx.query<Row>(
          `select ${columns} from local_memories where project_id=$1 and request_key=$2`,
          [row.projectId, row.requestKey],
        );
        if (previous.rows[0]) {
          if (previous.rows[0].digest !== row.digest)
            throw new Error('Idempotency key already used for different content.');
          return fromRow(previous.rows[0]);
        }
        await tx.query(insertSql, values(row));
        return row;
      }),
    );
  }

  async candidates(projectId: string, tokens: string[]): Promise<StoredMemory[]> {
    return this.run(async (db) => {
      const result = await db.query<Row>(
        `select ${columns} from local_memories
        where project_id=$1 and (layer in ('briefing','worklog') or cardinality($2::text[])=0 or tokens && $2::text[])
        order by (select count(*) from unnest(tokens) term where term=any($2::text[])) desc,
          created_at desc, id limit 200`,
        [projectId, tokens],
      );
      return result.rows.map(fromRow);
    });
  }
  async list(projectId: string): Promise<StoredMemory[]> {
    return this.run(async (db) => {
      const result = await db.query<Row>(
        `select ${columns} from local_memories where project_id=$1 order by created_at,id limit 10001`,
        [projectId],
      );
      if (result.rows.length > 10_000)
        throw new Error('Export exceeds 10000 memories; split the project before exporting.');
      return result.rows.map(fromRow);
    });
  }
  async remove(projectId: string, id: string): Promise<boolean> {
    return this.run(async (db) => {
      const result = await db.query(
        'delete from local_memories where project_id=$1 and id=$2 returning id',
        [projectId, id],
      );
      if (result.rows.length) {
        await db.exec('vacuum full local_memories');
        await db.exec('checkpoint');
      }
      return result.rows.length > 0;
    });
  }
  async restore(projectId: string, rows: StoredMemory[]): Promise<void> {
    await this.run((db) =>
      db.transaction(async (tx: Transaction) => {
        for (const row of rows) {
          if (row.projectId !== projectId) throw new Error('Project mismatch.');
          const existing = await tx.query<Row>(
            `select ${columns} from local_memories where id=$1`,
            [row.id],
          );
          if (existing.rows[0]) {
            if (existing.rows[0].project_id !== projectId || existing.rows[0].digest !== row.digest)
              throw new Error('Restore conflicts with existing memory.');
            continue;
          }
          await tx.query(insertSql, values(row));
        }
      }),
    );
  }
}
