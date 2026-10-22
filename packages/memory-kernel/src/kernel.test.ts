import { randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { competenceCapsuleSchema, renderCompetenceCapsule } from './capsule.js';
import { MemoryEnvelopeCipher } from './crypto.js';

describe('portable memory kernel', () => {
  it('binds ciphertext to project identity and rejects another key', () => {
    const cipher = new MemoryEnvelopeCipher(randomBytes(32).toString('base64url'));
    const context = { memoryId: randomUUID(), projectId: randomUUID(), tenantId: 'local' };
    const envelope = cipher.encrypt('conteúdo privado', context);
    expect(cipher.decrypt(envelope, context)).toBe('conteúdo privado');
    expect(() => cipher.decrypt(envelope, { ...context, projectId: randomUUID() })).toThrow();
    expect(() =>
      new MemoryEnvelopeCipher(randomBytes(32).toString('base64url')).decrypt(envelope, context),
    ).toThrow();
    const corrupted = { ...envelope, ciphertext: Buffer.from(envelope.ciphertext) };
    corrupted.ciphertext[0] = (corrupted.ciphertext[0] ?? 0) ^ 1;
    expect(() => cipher.decrypt(corrupted, context)).toThrow();
  });
  it('retains the capsule wire format used by Server', () => {
    const capsule = competenceCapsuleSchema.parse({
      schema_version: 1,
      objective: 'Retomar projeto',
      outcome: 'Teste concluído',
    });
    expect(renderCompetenceCapsule(capsule)).toContain('# Cápsula de competência IADDRAM v1');
    expect(renderCompetenceCapsule(capsule)).toContain('## Resultado');
  });
});
