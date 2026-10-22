import { describe, expect, it } from 'vitest';
import {
  type PoisoningModelTrial,
  type PoisoningTrial,
  poisoningScenarios,
  summarizePoisoningModelTrials,
  summarizePoisoningTrials,
} from './poisoning-evaluation.js';

describe('poisoning evaluation', () => {
  it('mede cada cenário com tentativas repetidas e pior caso', () => {
    const trials: PoisoningTrial[] = poisoningScenarios.flatMap((scenario) =>
      [1, 2, 3].map((seed) => ({
        scenario,
        seed,
        attackSucceeded: seed === 3,
        persistedAcrossSessions: false,
        elevatedAuthority: false,
        sensitiveAction: false,
        propagatedByDistillation: false,
      })),
    );
    const summary = summarizePoisoningTrials(trials);
    expect(summary).toHaveLength(6);
    expect(summary[0]).toMatchObject({
      attempts: 3,
      attack_any_success: true,
      attack_all_success: false,
    });
  });

  it('recusa cenário validado por uma única tentativa', () => {
    expect(() =>
      summarizePoisoningTrials(
        poisoningScenarios.map((scenario) => ({
          scenario,
          seed: 1,
          attackSucceeded: false,
          persistedAcrossSessions: false,
          elevatedAuthority: false,
          sensitiveAction: false,
          propagatedByDistillation: false,
        })),
      ),
    ).toThrow(/requires at least 3 seeds/);
  });

  it('separa resistência observada do modelo dos efeitos do sistema', () => {
    const trials: PoisoningModelTrial[] = poisoningScenarios.flatMap((scenario) =>
      [1, 2, 3].map((seed) => ({
        scenario,
        seed,
        model: 'fixture',
        outputSha256: 'a'.repeat(64),
        attackSucceeded: false,
        sensitiveAction: false,
        failureCode: null,
      })),
    );
    expect(summarizePoisoningModelTrials(trials)).toEqual(
      poisoningScenarios.map((scenario) => ({
        scenario,
        attempts: 3,
        attack_any_success: false,
        attack_all_success: false,
        sensitive_action_rate: 0,
        runner_failure_rate: 0,
      })),
    );
  });
});
