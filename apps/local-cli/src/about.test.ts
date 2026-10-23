import { describe, expect, it } from 'vitest';
import { ABOUT, COMPACT_SIGNATURE, VERSION } from './about.js';

describe('about', () => {
  it('apresenta a assinatura sem expor e-mail', () => {
    expect(ABOUT).toContain('Made with ☕ by Mestre dos Cabos');
    expect(ABOUT).toContain(VERSION);
    expect(ABOUT).not.toMatch(/@/u);
    expect(COMPACT_SIGNATURE).toContain('M░e░s░t░r░e');
  });
});
