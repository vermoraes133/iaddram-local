import { createHash } from 'node:crypto';
import { z } from 'zod';

export const causalTreatmentSchema = z.enum(['memory_on', 'memory_off', 'vanilla_budget_matched']);
export const causalTaskSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{3,100}$/),
    family: z.enum([
      'project_continuation',
      'bug_fix',
      'operations',
      'research',
      'staleness',
      'safety',
    ]),
    prompt: z.string().min(1).max(8_000),
    initial_state: z.string().min(1).max(8_000),
    checkout: z
      .object({
        repository: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
        revision: z.string().regex(/^[a-f0-9]{7,40}$/),
      })
      .strict()
      .optional(),
    memories: z
      .array(z.object({ id: z.uuid(), content: z.string().min(1).max(8_000) }).strict())
      .max(20),
    evaluator: z
      .object({
        required_terms: z.array(z.string().min(1).max(200)).max(20),
        forbidden_terms: z.array(z.string().min(1).max(200)).max(20),
      })
      .strict(),
    fixture_outputs: z
      .object({
        memory_on: z.string(),
        memory_off: z.string(),
        vanilla_budget_matched: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const causalProtocolSchema = z
  .object({
    protocol: z.literal('iaddram-causal-eval-v2'),
    seed: z.string().min(1).max(100),
    model: z.string().min(1).max(200),
    adapter: z.enum(['fixture', 'command']),
    minimum_success_lift: z.number().min(0).max(1),
    max_latency_ratio: z.number().min(1).max(100),
    repetitions: z.number().int().min(1).max(20).default(3),
  })
  .strict();

export type CausalTask = z.infer<typeof causalTaskSchema>;
export type CausalTreatment = z.infer<typeof causalTreatmentSchema>;
export type CausalProtocol = z.infer<typeof causalProtocolSchema>;

export interface CausalTrial {
  task_id: string;
  family: CausalTask['family'];
  treatment: CausalTreatment;
  repetition: number;
  order: number;
  model: string;
  adapter: CausalProtocol['adapter'];
  prompt_sha256: string;
  initial_state_sha256: string;
  memory_ids: string[];
  output_sha256: string;
  success: boolean;
  unsafe: boolean;
  latency_ms: number;
  input_units: number;
  output_units: number;
  cached_input_units: number;
  cost_usd: number;
  cost_measured: boolean;
  failure_code: string | null;
}

export interface CausalRunReport {
  protocol: CausalProtocol;
  run_id: string;
  started_at: string;
  trials: CausalTrial[];
  summary: {
    tasks: number;
    memory_on_success_rate: number;
    memory_off_success_rate: number;
    vanilla_budget_matched_success_rate: number;
    paired_success_lift: number;
    budget_matched_success_lift: number;
    paired_success_lift_ci95: [number, number];
    memory_on_unsafe_rate: number;
    memory_off_unsafe_rate: number;
    vanilla_budget_matched_unsafe_rate: number;
    latency_ratio: number;
    token_ratio: number;
    success_lift_per_1k_units: number;
    any_success_rate: Record<CausalTreatment, number>;
    all_success_rate: Record<CausalTreatment, number>;
    gate_passed: boolean;
  };
}

export function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function treatmentOrder(taskId: string, seed: string, repetition = 0): CausalTreatment[] {
  const treatments: CausalTreatment[] = ['memory_on', 'memory_off', 'vanilla_budget_matched'];
  return treatments.sort((left, right) =>
    sha256Text(`${seed}:${taskId}:${repetition}:${left}`).localeCompare(
      sha256Text(`${seed}:${taskId}:${repetition}:${right}`),
    ),
  );
}

export function scoreCausalOutput(
  output: string,
  evaluator: CausalTask['evaluator'],
): { success: boolean; unsafe: boolean } {
  const normalized = output.normalize('NFKC').toLocaleLowerCase('pt-BR');
  const unsafe = evaluator.forbidden_terms.some((term) =>
    normalized.includes(term.normalize('NFKC').toLocaleLowerCase('pt-BR')),
  );
  const complete = evaluator.required_terms.every((term) =>
    normalized.includes(term.normalize('NFKC').toLocaleLowerCase('pt-BR')),
  );
  return { success: complete && !unsafe, unsafe };
}

export function summarizeCausalRun(
  protocol: CausalProtocol,
  trials: CausalTrial[],
): CausalRunReport['summary'] {
  const on = trials.filter((trial) => trial.treatment === 'memory_on');
  const off = trials.filter((trial) => trial.treatment === 'memory_off');
  const budgetMatched = trials.filter((trial) => trial.treatment === 'vanilla_budget_matched');
  const rate = (items: CausalTrial[], predicate: (trial: CausalTrial) => boolean) =>
    items.length === 0 ? 0 : items.filter(predicate).length / items.length;
  const onSuccess = rate(on, (trial) => trial.success);
  const offSuccess = rate(off, (trial) => trial.success);
  const budgetMatchedSuccess = rate(budgetMatched, (trial) => trial.success);
  const onUnsafe = rate(on, (trial) => trial.unsafe);
  const offUnsafe = rate(off, (trial) => trial.unsafe);
  const budgetMatchedUnsafe = rate(budgetMatched, (trial) => trial.unsafe);
  const averageLatency = (items: CausalTrial[]) =>
    items.length === 0
      ? 0
      : items.reduce((total, trial) => total + trial.latency_ms, 0) / items.length;
  const offLatency = averageLatency(off);
  const latencyRatio = offLatency === 0 ? 1 : averageLatency(on) / offLatency;
  const averageUnits = (items: CausalTrial[]) =>
    items.length === 0
      ? 0
      : items.reduce(
          (total, trial) =>
            total + trial.input_units + trial.output_units - trial.cached_input_units,
          0,
        ) / items.length;
  const baselineUnits = averageUnits(budgetMatched);
  const onUnits = averageUnits(on);
  const tokenRatio = baselineUnits === 0 ? 1 : onUnits / baselineUnits;
  const lift = onSuccess - offSuccess;
  const budgetLift = onSuccess - budgetMatchedSuccess;
  const liftInterval = pairedBootstrapInterval(trials);
  const anyAll = (treatment: CausalTreatment) => {
    const byTask = [...new Set(trials.map((trial) => trial.task_id))].map((taskId) =>
      trials.filter((trial) => trial.task_id === taskId && trial.treatment === treatment),
    );
    return {
      any:
        byTask.length === 0
          ? 0
          : byTask.filter((items) => items.some((item) => item.success)).length / byTask.length,
      all:
        byTask.length === 0
          ? 0
          : byTask.filter((items) => items.length > 0 && items.every((item) => item.success))
              .length / byTask.length,
    };
  };
  const anyAllByTreatment = {
    memory_on: anyAll('memory_on'),
    memory_off: anyAll('memory_off'),
    vanilla_budget_matched: anyAll('vanilla_budget_matched'),
  };
  return {
    tasks: new Set(trials.map((trial) => trial.task_id)).size,
    memory_on_success_rate: onSuccess,
    memory_off_success_rate: offSuccess,
    vanilla_budget_matched_success_rate: budgetMatchedSuccess,
    paired_success_lift: lift,
    budget_matched_success_lift: budgetLift,
    paired_success_lift_ci95: liftInterval,
    memory_on_unsafe_rate: onUnsafe,
    memory_off_unsafe_rate: offUnsafe,
    vanilla_budget_matched_unsafe_rate: budgetMatchedUnsafe,
    latency_ratio: latencyRatio,
    token_ratio: tokenRatio,
    success_lift_per_1k_units: onUnits === 0 ? 0 : (budgetLift * 1_000) / onUnits,
    any_success_rate: {
      memory_on: anyAllByTreatment.memory_on.any,
      memory_off: anyAllByTreatment.memory_off.any,
      vanilla_budget_matched: anyAllByTreatment.vanilla_budget_matched.any,
    },
    all_success_rate: {
      memory_on: anyAllByTreatment.memory_on.all,
      memory_off: anyAllByTreatment.memory_off.all,
      vanilla_budget_matched: anyAllByTreatment.vanilla_budget_matched.all,
    },
    gate_passed:
      lift >= protocol.minimum_success_lift &&
      budgetLift >= protocol.minimum_success_lift &&
      liftInterval[0] > 0 &&
      onUnsafe <= Math.min(offUnsafe, budgetMatchedUnsafe) &&
      latencyRatio <= protocol.max_latency_ratio &&
      on.every((trial) => trial.failure_code === null) &&
      off.every((trial) => trial.failure_code === null) &&
      budgetMatched.every((trial) => trial.failure_code === null),
  };
}

function pairedBootstrapInterval(trials: CausalTrial[]): [number, number] {
  const pairs = [...new Set(trials.map((trial) => `${trial.task_id}:${trial.repetition}`))].sort();
  const differences = pairs.flatMap((pair) => {
    const separator = pair.lastIndexOf(':');
    const taskId = pair.slice(0, separator);
    const repetition = Number(pair.slice(separator + 1));
    const on = trials.find(
      (trial) =>
        trial.task_id === taskId &&
        trial.repetition === repetition &&
        trial.treatment === 'memory_on',
    );
    const off = trials.find(
      (trial) =>
        trial.task_id === taskId &&
        trial.repetition === repetition &&
        trial.treatment === 'vanilla_budget_matched',
    );
    return on && off ? [Number(on.success) - Number(off.success)] : [];
  });
  if (differences.length === 0) return [0, 0];

  let state = Number.parseInt(sha256Text(pairs.join(':')).slice(0, 8), 16) >>> 0;
  const random = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
  const samples = Array.from({ length: 4_000 }, () => {
    let total = 0;
    for (let index = 0; index < differences.length; index += 1) {
      total += differences[Math.floor(random() * differences.length)] ?? 0;
    }
    return total / differences.length;
  }).sort((left, right) => left - right);
  return [
    samples[Math.floor(samples.length * 0.025)] ?? 0,
    samples[Math.floor(samples.length * 0.975)] ?? 0,
  ];
}
