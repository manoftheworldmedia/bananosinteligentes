# Memory System

## Purpose

The memory system allows Banana Chat and related AI workflows to remember useful context while preserving tenant isolation, consent, ownership, auditability, and user control.

Memory is not a hidden cache of everything users say. It is an explicit governed data class with scope, policy, provenance, and deletion behavior.

## Memory Types

### Conversation Memory

Short-lived context from an active conversation. Used to maintain continuity within a session.

### User Memory

Durable preferences and working context for a specific user, such as preferred units, reporting style, role, farms they usually manage, or recurring questions.

### Tenant Memory

Durable organizational context approved for tenant-level use, such as internal terminology, operating assumptions, preferred KPIs, and known constraints.

### Entity Memory

Durable context linked to farms, blocks, crop cycles, sources, equipment, or practices.

### Agronomic Memory

Bananos-owned reusable knowledge captured from reviewed insights, playbooks, and expert-authored content.

### Network Memory

Privacy-preserving learned patterns from consented network intelligence artifacts.

## Memory Ownership

Memory ownership depends on origin:

- User preferences are controlled by the user and tenant policy.
- Tenant operational memories are client-owned or tenant-controlled.
- Reviewed intelligence memories are Bananos-owned artifacts.
- Network memories are Bananos-owned artifacts created under consent and privacy controls.

Each memory must declare ownership and retrieval scope.

## Memory Schema

Recommended fields:

- `memory_id`
- `memory_type`
- `tenant_id`
- `user_id`
- `entity_id`
- `scope`
- `content`
- `structured_values`
- `source_ref`
- `lineage_id`
- `owner_type`
- `visibility_scope`
- `confidence_score`
- `consent_policy_id`
- `retention_policy_id`
- `retrieval_policy_id`
- `created_at`
- `updated_at`
- `expires_at`
- `last_used_at`
- `validation_status`
- `version`

## Memory Scopes

- Session.
- User.
- Role.
- Team.
- Farm.
- Block.
- Crop cycle.
- Tenant.
- Cohort.
- Network.
- Global.

Broader scopes require stronger governance and review.

## Memory Creation

Memory can be created from:

- Explicit user instruction.
- Repeated user preference.
- Reviewed tenant configuration.
- Published insight.
- Entity update.
- Human-reviewed AI summary.
- Network intelligence artifact.

The system should avoid silently creating durable memories from sensitive conversations. Explicit confirmation should be required for broad or sensitive memory scopes.

## Memory Retrieval

Memory retrieval must consider:

- Active user authorization.
- Tenant context.
- Conversation purpose.
- Entity context.
- Consent.
- Sensitivity.
- Recency.
- Confidence.
- Expiration.

Retrieval should happen before prompt construction and after policy filtering.

## Memory Deletion and Revocation

Users and tenant administrators should be able to:

- View memories.
- Edit memories.
- Delete memories.
- Disable memory creation.
- Restrict memory scopes.
- Revoke use of tenant memories for AI.

Deletion should remove memory from vector indexes and retrieval caches where feasible.

## Memory and Insights

Durable agronomic conclusions should not live only in memory. If a conclusion has lasting value, it should be promoted into the Insights Repository as a draft artifact and reviewed.

Memory is for personalization, continuity, and context. The Insights Repository is for governed intelligence.

## Memory and Knowledge Graph

Memory entries may become graph nodes when they refer to durable entities or concepts. For example:

- A block has a known drainage problem.
- A tenant uses an internal name for a packing facility.
- A user prefers risk views by farm manager.

Graph-linked memories still obey memory governance and deletion policies.

## AI Orchestration Requirements

The AI orchestration service should:

- Retrieve memory only after policy checks.
- Separate memory from evidence in prompts.
- Label memory context by source and confidence.
- Avoid using memory as proof unless evidence supports it.
- Log which memories influenced a response.
- Update memory only through approved workflows.

## Memory Quality

Memory can become stale. The system should support:

- Expiration.
- Revalidation prompts.
- Confidence decay.
- Conflict detection.
- Source comparison.
- User correction.

Stale or low-confidence memory should not drive high-impact recommendations.

## Examples

Good memory:

- "This user prefers hectares and metric tons."
- "Tenant calls Farm 17 'La Ceiba' internally."
- "Block A12 has recurring drainage concerns noted by the agronomy team."

Bad memory:

- Unreviewed disease diagnosis treated as fact.
- Sensitive contract details stored without consent.
- Cross-tenant operational detail stored in global memory.
- A one-off user frustration stored as a durable preference.
