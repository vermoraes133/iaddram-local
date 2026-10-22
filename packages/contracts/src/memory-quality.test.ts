import { describe, expect, it } from 'vitest';
import { assessMemoryQuality } from './memory-quality.js';

describe('qualidade de memória', () => {
  it('aceita cápsula estruturada e útil', () => {
    const quality = assessMemoryQuality(
      `# Cápsula\n## Objetivo\nEntregar recall.\n## Resultado\nImplementado.\n## Decisões\n- PostgreSQL.\n## Evidências\n- teste passou no commit abc123.\n## Artefatos\n- src/memory.ts\n## Próximos passos\n- medir uso.\n## Restrições\n- preservar RLS.`,
      ['competence-capsule-v1'],
      'worklog',
    );
    expect(quality.accepted).toBe(true);
    expect(quality.purpose).toBe('knowledge');
    expect(quality.score).toBeGreaterThanOrEqual(80);
  });

  it('isola smoke com expiração curta sem rejeitá-lo', () => {
    const quality = assessMemoryQuality('canário remoto', ['production-smoke'], 'worklog');
    expect(quality).toMatchObject({ accepted: true, purpose: 'smoke', retentionDays: 7 });
  });

  it('rejeita marcador curto disfarçado de conhecimento', () => {
    const quality = assessMemoryQuality('F8 ativo.', ['f8', 'encryption'], 'worklog');
    expect(quality.accepted).toBe(false);
    expect(quality.purpose).toBe('quarantined');
    expect(quality.rejectionReasons).toContain('too_short');
  });

  const capsula = (resultado: string) =>
    `# Cápsula\n## Objetivo\nValidar presets.\n## Resultado\n${resultado}\n## Decisões\n- PostgreSQL.\n## Evidências\n- teste passou no commit abc123.\n## Artefatos\n- src/memory.ts\n## Próximos passos\n- medir uso.\n## Restrições\n- preservar RLS.`;

  it('não confunde "todo", "método" e "preencher" do português com marcador de rascunho', () => {
    // Caso real do sonymagic (2026-10-14): recusado 3 vezes por placeholder_heavy.
    const quality = assessMemoryQuality(
      capsula(
        [
          'Todo preset agora passa pela validação de BCD.',
          'O servidor recusa todo POST sem Content-Length; em todo caso, toda rota loga o motivo.',
          'O método de envio mudou e o usuário pode preencher o formulário ou pré-preencher o cache.',
        ].join('\n'),
      ),
      ['competence-capsule-v1'],
      'worklog',
    );
    expect(quality.signals.placeholders).toBe(0);
    expect(quality.rejectionReasons).not.toContain('placeholder_heavy');
    expect(quality.accepted).toBe(true);
  });

  it('continua recusando cápsula com marcadores de rascunho reais', () => {
    for (const resultado of [
      '- TODO: medir latência.\n- TODO: revisar índice.',
      '- todo: medir latência.\n- FIXME revisar índice.',
      // Template do workflow anterior a f47dbed, recusado em 2026-08-19.
      '- TODO (preencher antes do finish)\n- TODO',
      'Commit: preencher\n- [preencher com o SHA]',
      'Status: tbd\nLorem ipsum dolor sit amet.',
    ]) {
      const quality = assessMemoryQuality(capsula(resultado), ['competence-capsule-v1'], 'worklog');
      expect(quality.signals.placeholders, resultado).toBeGreaterThanOrEqual(2);
      expect(quality.rejectionReasons, resultado).toContain('placeholder_heavy');
      expect(quality.accepted, resultado).toBe(false);
    }
  });

  it('não conta marcador citado em código', () => {
    const quality = assessMemoryQuality(
      capsula('A heurística ignora `TODO:` citado.\n```ts\n// TODO: exemplo\n// FIXME\n```'),
      ['competence-capsule-v1'],
      'worklog',
    );
    expect(quality.signals.placeholders).toBe(0);
    expect(quality.accepted).toBe(true);
  });

  it('permite memória semântica atômica', () => {
    const quality = assessMemoryQuality(
      'O tenant_id é uma fronteira de segurança protegida por RLS.',
      ['deterministic-distilled-v1'],
      'semantic',
    );
    expect(quality.accepted).toBe(true);
    expect(quality.score).toBeGreaterThanOrEqual(50);
  });
});
