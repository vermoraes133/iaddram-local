const SECRET_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,255}\b/ },
  { name: 'openai-key', pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{24,}\b/i },
  {
    name: 'assigned-secret',
    pattern:
      /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{16,}/i,
  },
];

export interface SecretScanResult {
  safe: boolean;
  detections: string[];
}

export function scanForSecrets(content: string): SecretScanResult {
  const detections = SECRET_PATTERNS.filter(({ pattern }) => pattern.test(content)).map(
    ({ name }) => name,
  );
  return { safe: detections.length === 0, detections };
}
