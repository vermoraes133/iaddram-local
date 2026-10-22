import { randomBytes, scryptSync } from 'node:crypto';
import { decodeEnvelope, encodeEnvelope, MemoryEnvelopeCipher } from '@iaddram/memory-kernel';
import { z } from 'zod';

const headerSchema = z
  .object({
    version: z.literal(1),
    project_id: z.uuid(),
    salt: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    envelope: z.unknown(),
  })
  .strict();
function backupCipher(passphrase: string, salt: Buffer) {
  z.string().min(16).max(1024).parse(passphrase);
  const key = scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  try {
    return new MemoryEnvelopeCipher(key.toString('base64url'));
  } finally {
    key.fill(0);
  }
}
const context = (id: string) => ({
  memoryId: 'backup-v1',
  tenantId: 'local-backup',
  projectId: id,
});
export function encryptBackup(projectId: string, records: unknown, passphrase: string): string {
  z.uuid().parse(projectId);
  const salt = randomBytes(16);
  return JSON.stringify({
    version: 1,
    project_id: projectId,
    salt: salt.toString('base64url'),
    envelope: encodeEnvelope(
      backupCipher(passphrase, salt).encrypt(JSON.stringify(records), context(projectId)),
    ),
  });
}
export function decryptBackup(raw: string, projectId: string, passphrase: string): unknown {
  const header = headerSchema.parse(JSON.parse(raw));
  if (header.project_id !== projectId) throw new Error('Backup belongs to another project.');
  return JSON.parse(
    backupCipher(passphrase, Buffer.from(header.salt, 'base64url')).decrypt(
      decodeEnvelope(header.envelope),
      context(projectId),
    ),
  );
}
