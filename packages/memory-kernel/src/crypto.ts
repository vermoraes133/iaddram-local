import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export interface MemoryEnvelope {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
  wrappedDek: Buffer;
  dekNonce: Buffer;
  dekTag: Buffer;
  keyVersion: string;
}

export interface MemoryEnvelopeContext {
  memoryId: string;
  tenantId: string;
  projectId: string;
}

export class MemoryEnvelopeCipher {
  readonly keyVersion: string;
  readonly #kek: Buffer;

  constructor(encodedKey: string, keyVersion = 'v1') {
    const key = Buffer.from(encodedKey, 'base64url');
    if (key.length !== 32) throw new Error('MEMORY_MASTER_KEY must contain 32 base64url bytes');
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyVersion)) {
      throw new Error('MEMORY_KEY_VERSION is invalid');
    }
    this.#kek = key;
    this.keyVersion = keyVersion;
  }

  encrypt(content: string, context: MemoryEnvelopeContext): MemoryEnvelope {
    const dek = randomBytes(32);
    try {
      const aad = associatedData(context, this.keyVersion);
      const nonce = randomBytes(NONCE_BYTES);
      const cipher = createCipheriv(ALGORITHM, dek, nonce, { authTagLength: TAG_BYTES });
      cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();

      const dekNonce = randomBytes(NONCE_BYTES);
      const wrapper = createCipheriv(ALGORITHM, this.#kek, dekNonce, { authTagLength: TAG_BYTES });
      wrapper.setAAD(Buffer.concat([aad, Buffer.from(':dek', 'utf8')]));
      const wrappedDek = Buffer.concat([wrapper.update(dek), wrapper.final()]);
      return {
        ciphertext,
        nonce,
        tag,
        wrappedDek,
        dekNonce,
        dekTag: wrapper.getAuthTag(),
        keyVersion: this.keyVersion,
      };
    } finally {
      dek.fill(0);
    }
  }

  decrypt(envelope: MemoryEnvelope, context: MemoryEnvelopeContext): string {
    if (envelope.keyVersion !== this.keyVersion) {
      throw new Error(`unsupported memory key version: ${envelope.keyVersion}`);
    }
    const aad = associatedData(context, envelope.keyVersion);
    const unwrapper = createDecipheriv(ALGORITHM, this.#kek, envelope.dekNonce, {
      authTagLength: TAG_BYTES,
    });
    unwrapper.setAAD(Buffer.concat([aad, Buffer.from(':dek', 'utf8')]));
    unwrapper.setAuthTag(envelope.dekTag);
    const dek = Buffer.concat([unwrapper.update(envelope.wrappedDek), unwrapper.final()]);
    try {
      const decipher = createDecipheriv(ALGORITHM, dek, envelope.nonce, {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(aad);
      decipher.setAuthTag(envelope.tag);
      return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]).toString(
        'utf8',
      );
    } finally {
      dek.fill(0);
    }
  }

  searchTokens(value: string): string[] {
    const terms = value
      .normalize('NFKC')
      .toLocaleLowerCase('pt-BR')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length >= 2)
      .slice(0, 512);
    return [...new Set(terms)].map((term) =>
      createHmac('sha256', this.#kek)
        .update(`iaddram:search:v1:${term}`, 'utf8')
        .digest('base64url'),
    );
  }

  contentFingerprint(value: string, tenantId: string, projectId: string): Buffer {
    const normalized = value
      .normalize('NFKC')
      .replaceAll('\r\n', '\n')
      .replace(/[ \t]+/gu, ' ')
      .replace(/\n{3,}/gu, '\n\n')
      .trim();
    return createHmac('sha256', this.#kek)
      .update(`iaddram:fingerprint:v1:${tenantId}:${projectId}:`, 'utf8')
      .update(normalized, 'utf8')
      .digest();
  }
}

function associatedData(context: MemoryEnvelopeContext, keyVersion: string): Buffer {
  return Buffer.from(
    `iaddram:memory:${keyVersion}:${context.tenantId}:${context.projectId}:${context.memoryId}`,
    'utf8',
  );
}
