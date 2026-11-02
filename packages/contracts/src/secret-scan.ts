const SECRET_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'private-key', pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/ },
  { name: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,255}\b/ },
  { name: 'openai-key', pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { name: 'stripe-key', pattern: /\b[rs]k_(?:live|test)_[0-9A-Za-z]{16,}\b/ },
  { name: 'slack-token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'npm-token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/ },
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{24,}\b/i },
  {
    name: 'assigned-secret',
    pattern:
      /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token)["']?\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{16,}/i,
  },
];

// Caracteres invisíveis que quebram padrões sem mudar o que o leitor vê.
const INVISIBLE = /[­​-‏⁠‪-‮﻿]/gu;

export interface SecretScanResult {
  safe: boolean;
  detections: string[];
}

/** Variantes do texto: original, normalizada (NFKC, sem invisíveis) e sem escapes JSON. */
function variants(content: string): string[] {
  const normalized = content.normalize('NFKC').replace(INVISIBLE, '');
  const unescaped = normalized.replace(/\\(["'\\/])/gu, '$1');
  return [...new Set([content, normalized, unescaped])];
}

export function scanForSecrets(content: string): SecretScanResult {
  const texts = variants(content);
  const detections = SECRET_PATTERNS.filter(({ pattern }) =>
    texts.some((text) => pattern.test(text)),
  ).map(({ name }) => name);
  return { safe: detections.length === 0, detections };
}
