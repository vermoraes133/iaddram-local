import { randomUUID } from 'node:crypto';
import {
  assessMemoryQuality,
  buildContextEnvelope,
  type ContextMemory,
  idempotencyKeySchema,
  memoryWriteSchema,
  recallRequestSchema,
  scanForSecrets,
} from '@iaddram/contracts';
import { z } from 'zod';
import type { MemoryEnvelope, MemoryEnvelopeCipher } from './crypto.js';

const envelopeSchema = z
  .object({
    ciphertext: z.string(),
    nonce: z.string(),
    tag: z.string(),
    wrappedDek: z.string(),
    dekNonce: z.string(),
    dekTag: z.string(),
    keyVersion: z.string(),
  })
  .strict();
export type EncodedEnvelope = z.infer<typeof envelopeSchema>;
export function encodeEnvelope(value: MemoryEnvelope): EncodedEnvelope {
  return {
    ciphertext: value.ciphertext.toString('base64url'),
    nonce: value.nonce.toString('base64url'),
    tag: value.tag.toString('base64url'),
    wrappedDek: value.wrappedDek.toString('base64url'),
    dekNonce: value.dekNonce.toString('base64url'),
    dekTag: value.dekTag.toString('base64url'),
    keyVersion: value.keyVersion,
  };
}
export function decodeEnvelope(raw: unknown): MemoryEnvelope {
  const value = envelopeSchema.parse(raw);
  return {
    ciphertext: Buffer.from(value.ciphertext, 'base64url'),
    nonce: Buffer.from(value.nonce, 'base64url'),
    tag: Buffer.from(value.tag, 'base64url'),
    wrappedDek: Buffer.from(value.wrappedDek, 'base64url'),
    dekNonce: Buffer.from(value.dekNonce, 'base64url'),
    dekTag: Buffer.from(value.dekTag, 'base64url'),
    keyVersion: value.keyVersion,
  };
}

export const recordSchema = memoryWriteSchema.extend({
  id: z.uuid(),
  valid_from: z.iso.datetime({ offset: true }),
  authority: z
    .object({
      origin_class: z.literal('agent'),
      authority_scope: z.literal('inform'),
      review_state: z.literal('automatic'),
      taint_labels: z.array(z.string()),
    })
    .strict(),
  derived_from: z.array(z.uuid()),
});
export type MemoryRecord = z.infer<typeof recordSchema>;
export interface StoredMemory {
  id: string;
  projectId: string;
  layer: string;
  envelope: EncodedEnvelope;
  tokens: string[];
  requestKey: string;
  digest: string;
  createdAt: string;
}
export interface MemoryStore {
  put(memory: StoredMemory): Promise<StoredMemory>;
  candidates(projectId: string, tokens: string[]): Promise<StoredMemory[]>;
  list(projectId: string): Promise<StoredMemory[]>;
  remove(projectId: string, id: string): Promise<boolean>;
  restore(projectId: string, rows: StoredMemory[]): Promise<void>;
}

/** Domain rules shared by local transports; storage never receives plaintext content. */
export class MemoryKernel {
  constructor(
    private readonly store: MemoryStore,
    private readonly cipher: MemoryEnvelopeCipher,
    private readonly agentId: string,
    private readonly projectId: string,
  ) {
    z.uuid().parse(agentId);
    z.uuid().parse(projectId);
  }

  async remember(raw: unknown, idempotencyKey: string): Promise<MemoryRecord> {
    const input = memoryWriteSchema.parse(raw);
    this.checkProject(input.project_id);
    idempotencyKeySchema.parse(idempotencyKey);
    if (input.layer === 'briefing')
      throw new Error('Briefing requires human review; agent writes use worklog or semantic.');
    if (!scanForSecrets(JSON.stringify(input)).safe)
      throw new Error('Potential secret detected; remove credentials before saving.');
    const quality = assessMemoryQuality(input.content, input.tags, input.layer);
    if (!quality.accepted || quality.purpose !== 'knowledge')
      throw new Error(`Memory rejected: ${quality.rejectionReasons.join(', ') || quality.purpose}`);
    const record = recordSchema.parse({
      ...input,
      id: randomUUID(),
      valid_from: new Date().toISOString(),
      provenance: {
        ...input.provenance,
        agent_id: this.agentId,
        source_type: 'agent',
        trust: 'normal',
      },
      authority: {
        origin_class: 'agent',
        authority_scope: 'inform',
        review_state: 'automatic',
        taint_labels: [],
      },
      derived_from: [],
    });
    const row = this.seal(record, idempotencyKey);
    return this.open(await this.store.put(row));
  }

  async recall(raw: unknown) {
    const input = recallRequestSchema.parse(raw);
    this.checkProject(input.project_id);
    const tokens = this.cipher.searchTokens(input.query ?? '');
    const rows = await this.store.candidates(this.projectId, tokens);
    const items = rows.map((row) => {
      const matches = tokens.filter((token) => row.tokens.includes(token)).length;
      return {
        ...this.open(row),
        match_method: matches ? ('lexical' as const) : ('priority' as const),
        score: matches ? 0.6 + (0.4 * matches) / Math.max(1, tokens.length) : 0.5,
      };
    });
    const envelope = buildContextEnvelope(items as ContextMemory[], input.budget_tokens);
    const selected = new Set(
      [
        ...envelope.stable.briefing,
        ...envelope.stable.constraints,
        ...envelope.stable.procedures,
        ...envelope.dynamic.evidence,
      ].map((item) => item.id),
    );
    return {
      items: items.filter((item) => selected.has(item.id)),
      context_envelope: envelope,
      retrieval: { mode: 'textual' as const, fallback: false },
    };
  }

  async remove(id: string): Promise<boolean> {
    return this.store.remove(this.projectId, z.uuid().parse(id));
  }

  async exportRecords(): Promise<MemoryRecord[]> {
    return (await this.store.list(this.projectId)).map((row) => this.open(row));
  }

  async importRecords(raw: unknown): Promise<number> {
    const records = z.array(recordSchema).max(10_000).parse(raw);
    const ids = new Set<string>();
    for (const record of records) {
      this.checkProject(record.project_id);
      if (ids.has(record.id)) throw new Error('Duplicate memory ID in backup.');
      ids.add(record.id);
      if (!scanForSecrets(JSON.stringify(record)).safe)
        throw new Error('Potential secret in backup.');
      const quality = assessMemoryQuality(record.content, record.tags, record.layer);
      if (!quality.accepted || quality.purpose !== 'knowledge' || record.layer === 'briefing')
        throw new Error('Backup contains unsupported memory.');
    }
    // Validate the entire archive before a single atomic restore; preserve original provenance.
    await this.store.restore(
      this.projectId,
      records.map((record) => this.seal(record, `restore-${record.id}`)),
    );
    return records.length;
  }

  private checkProject(id: string) {
    if (id !== this.projectId) throw new Error('Project is outside this client scope.');
  }
  private seal(record: MemoryRecord, requestKey: string): StoredMemory {
    const content = JSON.stringify(record);
    return {
      id: record.id,
      projectId: this.projectId,
      layer: record.layer,
      envelope: encodeEnvelope(this.cipher.encrypt(content, this.context(record.id))),
      tokens: this.cipher.searchTokens(record.content),
      requestKey: this.cipher
        .contentFingerprint(requestKey, 'local', this.projectId)
        .toString('base64url'),
      // Ignore generated identifiers/time when detecting idempotency collisions.
      digest: this.cipher
        .contentFingerprint(
          JSON.stringify({ ...record, id: null, valid_from: null }),
          'local',
          this.projectId,
        )
        .toString('base64url'),
      createdAt: record.valid_from,
    };
  }
  private open(row: StoredMemory): MemoryRecord {
    this.checkProject(row.projectId);
    const record = recordSchema.parse(
      JSON.parse(this.cipher.decrypt(decodeEnvelope(row.envelope), this.context(row.id))),
    );
    this.checkProject(record.project_id);
    if (record.id !== row.id) throw new Error('Memory identity mismatch.');
    return record;
  }
  private context(id: string) {
    return { memoryId: id, tenantId: 'local', projectId: this.projectId };
  }
}
