import { z } from 'zod';

export const coordinationCreateSchema = z
  .object({
    task_id: z.uuid().describe('UUID estável da tarefa; reutilize para repetir a criação.'),
    brief_memory_id: z
      .uuid()
      .describe('Memória vigente contendo o objetivo e critérios de aceite.'),
  })
  .strict();
export const coordinationActionSchema = z
  .object({
    action: z.enum([
      'claim',
      'renew',
      'checkpoint',
      'submit',
      'release',
      'block',
      'unblock',
      'approve',
      'reject',
    ]),
    expected_version: z
      .number()
      .int()
      .positive()
      .max(2_147_483_646)
      .describe('Versão obtida na última leitura; não incremente por suposição.'),
    session_id: z
      .uuid()
      .describe('UUID fixo desta sessão de execução, não a identidade do agente.'),
    ttl_seconds: z.number().int().min(30).max(900).default(300),
    memory_id: z
      .uuid()
      .optional()
      .describe('Cápsula do executor, obrigatória em checkpoint, submit e block.'),
  })
  .strict();
export const coordinationListSchema = z
  .object({
    after: z.uuid().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .strict();
export const coordinationTaskSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  project_id: z.uuid(),
  creator_agent_id: z.uuid(),
  brief_memory_id: z.uuid(),
  delivery_memory_id: z.uuid().nullable(),
  state: z.enum(['pending', 'running', 'blocked', 'review', 'done']),
  holder_agent_id: z.uuid().nullable(),
  holder_session_id: z.uuid().nullable(),
  lease_until: z.iso.datetime({ offset: true }).nullable(),
  version: z.number().int().positive(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export const coordinationTaskResponseSchema = z.object({ task: coordinationTaskSchema });
export const coordinationListResponseSchema = z.object({
  tasks: z.array(coordinationTaskSchema).max(100),
  next_cursor: z.uuid().nullable(),
});

export const coordinationEvidenceResponseSchema = z.object({
  task: coordinationTaskSchema,
  memories: z
    .array(
      z.object({
        id: z.uuid(),
        layer: z.string(),
        type: z.string(),
        content: z.string(),
        valid_from: z.iso.datetime({ offset: true }),
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
      }),
    )
    .max(2),
  missing_memory_ids: z.array(z.uuid()).max(2),
});
