import { describe, expect, it, vi } from 'vitest';
import { buildContextEnvelope, type ContextMemory } from './context-envelope.js';

function memory(overrides: Partial<ContextMemory> = {}): ContextMemory {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    layer: 'semantic',
    type: 'fact',
    content: 'O deploy usa o script validado.',
    tags: ['deploy'],
    valid_from: '2026-08-20T00:00:00Z',
    score: 0.8,
    authority: {
      origin_class: 'repository',
      authority_scope: 'inform',
      review_state: 'automatic',
      taint_labels: [],
    },
    provenance: { source_type: 'repository' },
    ...overrides,
  };
}

describe('context envelope', () => {
  it('é determinístico, content-addressed e independente da ordem de entrada', () => {
    vi.setSystemTime(new Date('2026-08-21T00:00:00Z'));
    const first = memory();
    const second = memory({
      id: '00000000-0000-4000-8000-000000000002',
      type: 'procedure',
      tags: ['restore'],
      content: 'Execute o restore isolado antes de promover o backup.',
    });
    const left = buildContextEnvelope([first, second], 1_000);
    const right = buildContextEnvelope([second, first], 1_000);
    expect(left).toEqual(right);
    expect(left.content_hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('abstém quando a utilidade marginal não paga o orçamento', () => {
    const output = buildContextEnvelope(
      [
        memory({
          score: 0,
          authority: {
            ...memory().authority,
            origin_class: 'legacy_unverified',
            taint_labels: ['legacy_unverified', 'identity_unverified'],
          },
        }),
      ],
      1_000,
      100,
    );
    expect(output.decision).toBe('no_memory');
    expect(output.estimated_tokens).toBe(0);
  });

  it('expõe contradição sem escolher a versão mais frequente', () => {
    const output = buildContextEnvelope(
      [
        memory(),
        memory({ id: '00000000-0000-4000-8000-000000000002', content: 'O deploy não usa script.' }),
      ],
      1_000,
    );
    expect(output.dynamic.conflicts).toEqual([
      {
        memory_ids: [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
        ],
        reason: 'same_subject_conflict',
      },
    ]);
  });
});
