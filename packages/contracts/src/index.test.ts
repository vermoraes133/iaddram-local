import { describe, expect, it } from 'vitest';
import { ingestionRequestSchema, memoryWriteSchema } from './index.js';

const valid = {
  project_id: '018f47b8-86df-7c35-aab2-2f321d3c8ca1',
  layer: 'worklog',
  type: 'episode',
  content: 'A migration inicial foi criada.',
  provenance: {
    agent_id: '018f47b8-86df-7c35-aab2-2f321d3c8ca2',
    session_id: 'session-1',
    source_type: 'agent',
    captured_at: '2026-08-09T21:40:00Z',
  },
};

describe('memoryWriteSchema', () => {
  it('aceita uma memória atômica válida', () => {
    expect(memoryWriteSchema.parse(valid).tags).toEqual([]);
  });

  it('recusa campos inesperados', () => {
    expect(() => memoryWriteSchema.parse({ ...valid, tenant_id: valid.project_id })).toThrow();
  });

  it('recusa conteúdo vazio', () => {
    expect(() => memoryWriteSchema.parse({ ...valid, content: '   ' })).toThrow();
  });

  it('recusa tenant e campos extras na ingestão', () => {
    expect(() => ingestionRequestSchema.parse({ ...valid, tenant_id: valid.project_id })).toThrow();
  });
});
