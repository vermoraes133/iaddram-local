import { z } from 'zod';

// ADR-0019 v1: só graph_neighbors e graph_path. graph_clusters fica adiado.

const memoryNodeContentSchema = z.object({
  id: z.uuid(),
  layer: z.string(),
  type: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  provenance: z.object({
    agent_id: z.uuid(),
    session_id: z.string(),
    source_type: z.string(),
    captured_at: z.iso.datetime({ offset: true }),
    trust: z.string(),
    source_uri: z.string().nullable().optional(),
  }),
  authority: z.object({
    origin_class: z.string(),
    authority_scope: z.string(),
    review_state: z.string(),
    taint_labels: z.array(z.string()),
  }),
  valid_from: z.iso.datetime({ offset: true }),
});

export const graphNodeSchema = z.object({
  id: z.uuid(),
  node_type: z.enum(['memory', 'claim']),
  memory: memoryNodeContentSchema.nullable(),
  claim_statement: z.string().nullable(),
});

export const graphEdgeKindSchema = z.enum([
  'derived_from',
  'claim_supports',
  'claim_contradicts',
  'claim_supersedes',
  'coordination',
]);

export const graphEdgeSchema = z.object({
  from: z.uuid(),
  to: z.uuid(),
  kind: graphEdgeKindSchema,
});

export const graphTraversalSchema = z.object({
  nodes: z.array(graphNodeSchema).max(200),
  edges: z.array(graphEdgeSchema).max(800),
  truncated: z.boolean(),
});

export const graphNeighborsRequestSchema = z
  .object({
    memory_id: z.uuid().describe('Memória de partida da travessia.'),
    depth: z.number().int().min(1).max(4).default(2),
    node_limit: z.number().int().min(1).max(200).default(60),
  })
  .strict();

export const graphNeighborsResponseSchema = graphTraversalSchema;

export const graphPathRequestSchema = z
  .object({
    from_memory_id: z.uuid(),
    to_memory_id: z.uuid(),
    max_depth: z.number().int().min(1).max(8).default(8),
  })
  .strict();

export const graphPathResponseSchema = z.object({
  found: z.boolean(),
  path: graphTraversalSchema.nullable(),
});
