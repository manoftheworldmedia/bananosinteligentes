# Insights Repository

## Purpose

The Insights Repository is the system of record for Bananos Inteligentes-owned intelligence artifacts. It separates derived intelligence from client-owned raw operational data and provides governed access to findings, recommendations, forecasts, benchmarks, playbooks, risk scores, and network intelligence.

## Core Principle

An insight is not just a text summary. It is a governed artifact with evidence, provenance, confidence, ownership, visibility, lifecycle state, and policy.

## Insight Artifact Types

- Finding: An observed pattern or anomaly.
- Recommendation: A suggested action with rationale and expected impact.
- Forecast: A prediction about yield, disease risk, quality, labor demand, or timing.
- Benchmark: A comparison against historical, peer, regional, or network baselines.
- Risk Score: A quantified risk for a farm, block, cycle, disease, weather event, or operation.
- Playbook: A reusable agronomic or operational practice guide.
- Hypothesis: A proposed causal explanation requiring validation.
- Experiment Result: Outcome of a trial, intervention, or practice comparison.
- Alert: Time-sensitive notification derived from data or network signals.
- Model Evaluation: Performance and reliability result for a model or prompt.

## Ownership and Scope

Insight ownership scopes:

- Tenant-specific: Derived for one tenant and visible only to authorized tenant users.
- Cohort: Derived for a consented group with privacy controls.
- Network: Derived from cross-tenant aggregation and owned by Bananos Inteligentes.
- Global: Expert-authored or public-knowledge-backed artifact.
- Internal: Used for platform quality, review, or model improvement.

Every insight must declare its scope.

## Insight Schema

Recommended fields:

- `insight_id`
- `artifact_type`
- `title`
- `summary`
- `structured_claims`
- `recommendations`
- `subject_entities`
- `evidence_refs`
- `lineage_id`
- `owner_type`
- `visibility_scope`
- `tenant_id`
- `cohort_id`
- `confidence_score`
- `confidence_rationale`
- `impact_estimate`
- `risk_level`
- `created_by`
- `generation_method`
- `model_id`
- `prompt_version`
- `review_status`
- `reviewed_by`
- `published_at`
- `valid_from`
- `valid_until`
- `supersedes_insight_id`
- `policy_id`
- `consent_basis`
- `revocation_behavior`
- `version`

## Evidence Model

Evidence references may point to:

- Canonical records.
- Aggregated metrics.
- Knowledge graph paths.
- Prior insights.
- Public research.
- Expert notes.
- Model outputs.
- Experiment results.
- Weather or geospatial datasets.

Evidence should include:

- Evidence type.
- Source ownership.
- Visibility rules.
- Strength.
- Recency.
- Quality score.
- Citation or object reference.

## Lifecycle

1. Generated or authored.
2. Validated for policy and lineage.
3. Reviewed if required.
4. Approved.
5. Published.
6. Retrieved by apps, chat, graph, or alerts.
7. Monitored for drift or invalidation.
8. Deprecated, superseded, recalled, or archived.

## Review Requirements

Human review is required for:

- High-impact recommendations.
- Chemical, disease, safety, compliance, or financial guidance.
- Network intelligence publication.
- Low-confidence model-generated insights.
- Insights based on low-quality or incomplete data.
- Insights that may identify tenant behavior or competitive position.

## Relationship to Raw Data

The repository must not store raw operational records inside insight payloads. It should store references, aggregated summaries, and policy-filtered evidence descriptors.

Tenant-specific insights may cite raw or canonical tenant records if the viewing user is authorized. Network insights must cite aggregated evidence only.

## Relationship to Knowledge Graph

Insights should become graph nodes connected to:

- Subject entities.
- Agronomic concepts.
- Observed conditions.
- Recommended practices.
- Outcomes.
- Evidence.
- Similar prior cases.
- Models and prompts used to generate them.

Graph links support explainability, retrieval, impact analysis, and artifact evolution.

## Retrieval Modes

The repository should support:

- Entity-based lookup.
- Time-window lookup.
- Risk-priority lookup.
- Semantic search.
- Graph-neighborhood retrieval.
- Tenant-scoped retrieval.
- Network-artifact retrieval.
- Policy-filtered Banana Chat retrieval.

## Quality and Confidence

Confidence should be computed from:

- Evidence strength.
- Source data quality.
- Recency.
- Model performance.
- Historical validation.
- Expert review status.
- Agreement with known agronomic knowledge.
- Drift indicators.

Confidence is not static. It should update as new evidence arrives.

## Publication Controls

Publication requires:

- Ownership classification.
- Visibility scope.
- Evidence references.
- Lineage.
- Confidence.
- Review state.
- Consent basis.
- Expiration or revalidation policy.

The system should block publication when required metadata is missing.

## Revocation and Recall

An insight can be:

- Recomputed.
- Redacted.
- Recalled.
- Superseded.
- Archived.

Network artifacts must include contribution analysis sufficient to determine whether revocation requires recomputation or recall.

## Banana Chat Use

Banana Chat may retrieve insights only after policy filtering. Responses should cite insight titles, evidence types, confidence, and whether the insight is tenant-specific, network-derived, or general.

AI-generated chat conclusions that are durable and valuable should be promoted into draft insights, then reviewed before publication.
