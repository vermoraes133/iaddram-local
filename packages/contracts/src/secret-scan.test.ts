import { describe, expect, it } from 'vitest';
import { scanForSecrets } from './secret-scan.js';

// Fixtures sintéticos montados em tempo de execução: o código-fonte não contém tokens literais,
// o que evita falso positivo em gitleaks e push protection.
const join = (...parts: string[]) => parts.join('');
const filler = 'abcdefghijklmnopqrstuvwxyz0123456789';

describe('scanForSecrets', () => {
  const blocked: Record<string, string> = {
    'atribuição em texto puro': join('pass', 'word=', 'abcdefghijklmnop1234'),
    'JSON dentro do conteúdo serializado': JSON.stringify({
      content: join('{"pass', 'word":"', 'abcdefghijklmnop1234"}'),
    }),
    'JSON com aspas simples': JSON.stringify({
      content: join("{'api", "_key': '", "abcdefghijklmnop1234'}"),
    }),
    'token Slack': join('xo', 'xb-', '123456789012-123456789012-', filler.slice(0, 24)),
    'chave Google': join('AI', 'za', filler.slice(0, 35)),
    'chave Stripe': join('sk', '_live_', filler.slice(0, 24)),
    JWT: join('ey', 'JhbGciOiJIUzI1NiJ9.', 'ey', 'JzdWIiOiIxMjM0NTY3ODkwIn0.', filler),
    'chave PGP': join('-----BEGIN ', 'PGP PRIVATE', ' KEY BLOCK-----'),
    'chave criptografada': join('-----BEGIN ', 'ENCRYPTED PRIVATE', ' KEY-----'),
    'token npm': join('np', 'm_', filler.slice(0, 36)),
    'AWS com caractere invisível': join('AK', 'IA', '​', 'ABCDEFGHIJKLMNOP'),
    'chave Anthropic': join('sk', '-ant-api03-', filler),
  };

  for (const [name, content] of Object.entries(blocked)) {
    it(`bloqueia ${name}`, () => {
      expect(scanForSecrets(content).safe).toBe(false);
    });
  }

  it('não bloqueia texto comum nem menções curtas', () => {
    expect(scanForSecrets('Decisão: usar PGlite; a senha fica no cofre do sistema.').safe).toBe(
      true,
    );
    expect(scanForSecrets('O campo password aceita 8 caracteres.').safe).toBe(true);
    expect(scanForSecrets('versão 4.6.7 publicada em 2026-10-12').safe).toBe(true);
  });
});
