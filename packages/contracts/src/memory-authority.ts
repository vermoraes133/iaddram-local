import { z } from 'zod';

export const originClassSchema = z.enum([
  'owner',
  'agent',
  'trusted_tool',
  'user',
  'external_document',
  'web',
  'derived',
  'legacy_unverified',
]);

export const authorityScopeSchema = z.enum([
  'inform',
  'suggest_procedure',
  'change_briefing',
  'authorize_action',
]);

export const reviewStateSchema = z.enum(['automatic', 'reviewed', 'rejected', 'disputed']);

export const taintLabelSchema = z.enum([
  'authority_claim_ignored',
  'external_content',
  'identity_unverified',
  'instruction_detected',
  'conflict',
  'pii',
  'legacy_unverified',
  'derived_content',
]);

export const memoryAuthoritySchema = z
  .object({
    origin_class: originClassSchema,
    authority_scope: authorityScopeSchema,
    review_state: reviewStateSchema,
    taint_labels: z.array(taintLabelSchema).max(16),
  })
  .strict();

export const clientAuthorityClaimSchema = z
  .object({
    source_type: z.enum(['agent', 'human', 'repository', 'external']),
    trust: z.enum(['low', 'normal', 'reviewed']),
  })
  .strict();

export type OriginClass = z.infer<typeof originClassSchema>;
export type AuthorityScope = z.infer<typeof authorityScopeSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type TaintLabel = z.infer<typeof taintLabelSchema>;
export type MemoryAuthority = z.infer<typeof memoryAuthoritySchema>;
export type ClientAuthorityClaim = z.infer<typeof clientAuthorityClaimSchema>;

export const legacyUnverifiedAuthority: MemoryAuthority = {
  origin_class: 'legacy_unverified',
  authority_scope: 'inform',
  review_state: 'automatic',
  taint_labels: ['identity_unverified', 'legacy_unverified'],
};

export function mostRestrictiveAuthority(parents: readonly MemoryAuthority[]): MemoryAuthority {
  const taints = new Set<TaintLabel>(['derived_content']);
  for (const parent of parents) {
    for (const taint of parent.taint_labels) taints.add(taint);
  }
  return {
    origin_class: 'derived',
    authority_scope: 'inform',
    review_state: parents.some((parent) => parent.review_state === 'disputed')
      ? 'disputed'
      : 'automatic',
    taint_labels: [...taints],
  };
}
