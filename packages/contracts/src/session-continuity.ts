import { z } from 'zod';

// ADR-0020: sinal de continuidade de sessão, exposto só em iaddram_start_session.
export const previousSessionStatusSchema = z.enum([
  'first',
  'closed',
  'reopened',
  'in_progress',
  'stale',
  'possibly_incomplete',
]);

export const previousSessionSchema = z.object({
  status: previousSessionStatusSchema,
  agent_kind: z.string().nullable(),
  started_at: z.iso.datetime({ offset: true }).nullable(),
});

export type PreviousSessionStatus = z.infer<typeof previousSessionStatusSchema>;
export type PreviousSession = z.infer<typeof previousSessionSchema>;
