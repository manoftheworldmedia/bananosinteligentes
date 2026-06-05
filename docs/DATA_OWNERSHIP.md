# Data Ownership and Boundaries

## Core Doctrine

Bananos Inteligentes separates client-owned operational data from Bananos Inteligentes-owned intelligence artifacts. This separation is legal, technical, semantic, and product-visible.

Raw client data is not merely stored separately. It is governed by explicit ownership metadata, tenant isolation, consent state, allowed use policies, retention rules, and lineage.

## Ownership Classes

### Client-Owned Raw Operational Data

Client-owned raw operational data includes:

- Source records from farm management systems, ERPs, CRMs, accounting systems, compliance tools, and logistics systems.
- Raw field observations, scouting notes, images, documents, forms, and spreadsheets.
- Sensor data, weather station data, irrigation telemetry, drone data, satellite-derived tenant-specific observations, and equipment telemetry.
- Farm, block, lot, harvest, labor, input, cost, yield, quality, and sales records.
- Client-specific canonical facts transformed directly from client raw data.
- User-entered tenant annotations, corrections, and private notes.

Client-owned data may be processed by Bananos Inteligentes only according to contract, consent, and platform policy.

### Bananos Inteligentes-Owned Intelligence Artifacts

Bananos Inteligentes-owned intelligence artifacts include:

- Derived insights.
- Recommendations.
- Forecasts.
- Benchmarks.
- Risk models.
- Agronomic playbooks.
- Practice effectiveness findings.
- Network-level patterns.
- Generalized features and model improvements created under permitted use.
- Expert-authored or platform-authored knowledge graph concepts and relationships.

These artifacts must not contain identifiable raw client records unless the artifact is tenant-scoped and permissioned for that tenant.

### Mixed-Origin Records

Some records combine raw client data, platform intelligence, and public data. These require explicit component-level ownership metadata.

Examples:

- A tenant-specific disease risk forecast using client block observations and regional weather.
- A recommendation generated from tenant yield history plus network-level practice effectiveness.
- A graph path connecting client block conditions to public agronomic research and Bananos-owned playbooks.

Mixed-origin records must carry:

- Component ownership.
- Lineage.
- Use permissions.
- Deletion and revocation behavior.
- Visibility scope.

## Ownership Metadata

Every persisted record should include or inherit:

- `tenant_id`
- `owner_type`: client, bananos, public, partner, mixed
- `owner_id`
- `data_class`: raw, canonical, artifact, memory, audit, operational
- `visibility_scope`: tenant, partner, cohort, network, global, internal
- `permitted_uses`
- `consent_policy_id`
- `retention_policy_id`
- `lineage_id`
- `sensitivity_labels`
- `created_by`
- `created_at`
- `source_system`
- `version`

## Permitted Uses

Recommended permitted-use categories:

- Tenant operations.
- Tenant analytics.
- Tenant AI assistance.
- Tenant-specific model tuning.
- Cross-tenant anonymized aggregation.
- Network intelligence generation.
- Product quality monitoring.
- Support and troubleshooting.
- Security and abuse prevention.
- Legal and compliance retention.

Each use should be independently grantable, revocable, auditable, and enforceable.

## Consent Model

Consent is attached to tenant data at source, dataset, entity type, and use-case levels.

Consent states:

- Requested.
- Granted.
- Denied.
- Revoked.
- Expired.
- Suspended.

Consent must define:

- Granting authority.
- Effective date.
- Expiration date.
- Permitted uses.
- Data scope.
- Artifact consequences.
- Revocation behavior.
- Audit trail.

## Revocation Model

When consent is revoked:

- New processing for revoked uses must stop.
- Retrieval policies must exclude revoked data.
- Future network artifact generation must exclude revoked data.
- Tenant-specific derived artifacts may remain available to the tenant if allowed by contract.
- Existing network artifacts should be evaluated against revocation policy.
- If an artifact contains identifiable tenant contribution, it must be recalled or recomputed.
- If an artifact is privacy-preserving and no longer attributable, it may remain if contractually allowed.

Revocation behavior must be written into artifact lineage policy at creation time.

## Data Residency and Retention

The platform should support:

- Tenant-specific residency requirements.
- Source-level retention policies.
- Legal hold.
- Soft deletion and hard deletion.
- Archival tiers.
- Deletion verification reports.

Retention policies must differ by data class. Raw operational data, audit logs, AI traces, and intelligence artifacts should not share a single retention policy.

## Access Boundaries

Access should be controlled using both role and attribute policies:

- Tenant membership.
- Organization hierarchy.
- Farm or region assignment.
- Partner relationship.
- Data sensitivity.
- Consent scope.
- Artifact visibility.
- Purpose of access.
- Environment.

AI systems must receive only the data allowed by these access boundaries.

## AI-Specific Ownership Rules

- Raw client records must not be embedded into prompts unless policy permits tenant AI assistance for the active user.
- Cross-tenant examples must be retrieved only from network artifacts, not raw tenant records.
- Model training and fine-tuning require explicit permitted use.
- Conversation memory is tenant-scoped and user-scoped unless explicitly promoted.
- AI outputs that become insights must enter the Insights Repository review lifecycle.
- AI traces must redact or compartmentalize sensitive data where feasible.

## Product Requirements

The user interface must make ownership visible where it matters:

- Source settings show owner, scope, and permitted uses.
- Insight pages show whether an artifact is tenant-specific, network-derived, or global.
- Banana Chat citations show evidence type and permitted visibility.
- Governance console shows consent and revocation impact.
- Admin workflows expose lineage and deletion status.

## Compliance Posture

The platform should prepare for:

- Enterprise data processing agreements.
- Regional privacy requirements.
- Agricultural data stewardship commitments.
- Audit requests.
- Partner data sharing contracts.
- Model governance expectations.

Compliance is implemented through architecture, not documentation alone.
