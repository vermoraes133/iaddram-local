import { z } from 'zod';
import { clientAuthorityClaimSchema, memoryAuthoritySchema } from './memory-authority.js';

export * from './causal-evaluation.js';
export * from './context-envelope.js';
export * from './memory-authority.js';
export * from './memory-quality.js';
export * from './poisoning-evaluation.js';
export * from './secret-scan.js';

export const uuidSchema = z.uuid();

export const memoryLayerSchema = z.enum(['briefing', 'worklog', 'semantic']);
export const memoryTypeSchema = z.enum([
  'fact',
  'decision',
  'preference',
  'procedure',
  'episode',
  'constraint',
]);

export const provenanceSchema = z
  .object({
    agent_id: uuidSchema,
    session_id: z.string().trim().min(1).max(200),
    source_type: z.enum(['agent', 'human', 'repository', 'external']),
    source_uri: z.url().max(2_000).nullable().optional(),
    captured_at: z.iso.datetime({ offset: true }),
    trust: z.enum(['low', 'normal', 'reviewed']).default('normal'),
  })
  .strict();

export const effectiveProvenanceSchema = provenanceSchema.extend({
  source_type: z.enum(['agent', 'human', 'trusted_tool', 'derived', 'legacy_unverified']),
});

export const memoryWriteSchema = z
  .object({
    project_id: uuidSchema,
    subject_ref: z.string().trim().min(1).max(200).nullable().optional(),
    layer: memoryLayerSchema,
    type: memoryTypeSchema,
    content: z.string().trim().min(1).max(65_536),
    tags: z.array(z.string().trim().min(1).max(64)).max(32).default([]),
    provenance: provenanceSchema,
  })
  .strict();

export const recallRequestSchema = z
  .object({
    project_id: uuidSchema,
    query: z.string().trim().min(1).max(4_000).nullable().optional(),
    budget_tokens: z.number().int().min(256).max(16_000).default(4_000),
  })
  .strict();

export const idempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[\x21-\x7E]+$/);

export const ingestionRequestSchema = z
  .object({
    project_id: uuidSchema,
    subject_ref: z.string().trim().min(1).max(200).nullable().optional(),
    content: z.string().trim().min(1).max(262_144),
    layer: z.enum(['worklog', 'semantic']).default('semantic'),
    type: memoryTypeSchema.default('episode'),
    tags: z.array(z.string().trim().min(1).max(64)).max(32).default([]),
    provenance: provenanceSchema,
  })
  .strict();

export const authorizedMemoryWriteSchema = memoryWriteSchema
  .omit({ provenance: true })
  .extend({
    provenance: effectiveProvenanceSchema,
    authority: memoryAuthoritySchema,
    clientAuthorityClaim: clientAuthorityClaimSchema,
    derivedFrom: z.array(uuidSchema).max(100),
  })
  .strict();

export const authorizedIngestionRequestSchema = ingestionRequestSchema
  .omit({ provenance: true })
  .extend({
    provenance: effectiveProvenanceSchema,
    authority: memoryAuthoritySchema,
    clientAuthorityClaim: clientAuthorityClaimSchema,
    derivedFrom: z.array(uuidSchema).max(100),
  })
  .strict();

export const subjectOperationSchema = z.object({ project_id: uuidSchema }).strict();
export const jobIdSchema = uuidSchema;

export type MemoryWrite = z.infer<typeof memoryWriteSchema>;
export type RecallRequest = z.infer<typeof recallRequestSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type EffectiveProvenance = z.infer<typeof effectiveProvenanceSchema>;
export type MemoryLayer = z.infer<typeof memoryLayerSchema>;
export type MemoryType = z.infer<typeof memoryTypeSchema>;
export type IngestionRequest = z.infer<typeof ingestionRequestSchema>;
export type AuthorizedMemoryWrite = z.infer<typeof authorizedMemoryWriteSchema>;
export type AuthorizedIngestionRequest = z.infer<typeof authorizedIngestionRequestSchema>;
export type SubjectOperation = z.infer<typeof subjectOperationSchema>;
export * from './coordination.js';
export * from './memory-graph.js';
export * from './session-continuity.js';
