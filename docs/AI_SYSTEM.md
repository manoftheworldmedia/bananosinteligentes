# AI System and Banana Chat

## Purpose

The AI system powers Banana Chat, insight generation, summarization, retrieval, decision support, document extraction, graph enrichment, and network intelligence workflows. It must be governed, explainable, tenant-aware, and grounded in approved data.

## AI Principles

- Policy-filter retrieval before model calls.
- Cite evidence and distinguish evidence from memory.
- Preserve tenant isolation.
- Keep high-impact agronomic recommendations reviewable.
- Treat model outputs as probabilistic, not authoritative.
- Log model, prompt, retrieval, and tool lineage.
- Promote durable intelligence into the Insights Repository.
- Use smaller specialized workflows where possible instead of one opaque general agent.

## AI Orchestration Components

### Conversation Orchestrator

Handles Banana Chat sessions, user intent, context assembly, model routing, response generation, and follow-up actions.

### Retrieval Orchestrator

Combines policy-filtered retrieval from:

- Canonical warehouse.
- Insights Repository.
- Knowledge Graph.
- Vector store.
- Search index.
- Memory service.
- Public or expert knowledge stores.

### Tool Orchestrator

Allows AI workflows to call approved tools:

- Query canonical data.
- Run forecasts.
- Generate reports.
- Create draft insights.
- Inspect graph paths.
- Check consent.
- Open ingestion quality issues.
- Trigger notifications.

### Model Gateway

Centralizes model access, cost tracking, fallback routing, prompt logging, safety filters, and rate limits.

### Evaluation Service

Evaluates prompts, retrieval, model outputs, insight generation, extraction quality, and answer faithfulness.

## Banana Chat Request Flow

1. Authenticate user and tenant context.
2. Classify intent and risk level.
3. Determine required data scopes.
4. Evaluate policy and consent.
5. Retrieve memory with scope controls.
6. Retrieve evidence from insights, graph, canonical data, and documents.
7. Build prompt with citations and boundaries.
8. Select model and tools.
9. Generate response.
10. Validate output for policy, claims, and citations.
11. Log trace and audit event.
12. Optionally create memory, task, alert, or draft insight.

## Prompt Context Classes

- User question.
- Tenant context.
- Authorized memory.
- Retrieved evidence.
- Graph explanation paths.
- Insight artifacts.
- Tool outputs.
- Safety instructions.
- Output format.

The prompt should label each context class clearly so the model does not confuse memory with evidence.

## Risk Classification

Low risk:

- Summaries.
- Navigation.
- Simple metric explanations.
- Data quality questions.

Medium risk:

- Operational prioritization.
- Yield or quality interpretation.
- Routine agronomic suggestions.

High risk:

- Chemical recommendations.
- Disease diagnosis.
- Compliance interpretation.
- Financially material decisions.
- Cross-tenant comparisons.
- Labor or safety guidance.

High-risk answers require stronger citation, confidence, and escalation behavior.

## AI Output Requirements

Responses should include:

- Direct answer.
- Evidence citations where applicable.
- Confidence or uncertainty.
- Assumptions.
- Recommended next action.
- Escalation guidance when needed.

Responses should avoid:

- Revealing unauthorized tenant data.
- Presenting network intelligence as client-specific proof.
- Hiding low confidence.
- Making unsupported causal claims.
- Treating stale memory as current evidence.

## Insight Generation

AI may generate draft insights from:

- Detected anomalies.
- Repeated user questions.
- Model outputs.
- Graph patterns.
- Data quality changes.
- Network aggregation jobs.
- Expert-authored notes.

Draft insights must enter the Insights Repository lifecycle and may require human review before publication.

## Document Extraction

AI-assisted extraction should:

- Preserve source document references.
- Capture field confidence.
- Require review for low-confidence fields.
- Store extracted facts as canonical candidates.
- Avoid directly publishing extracted facts without validation.

## Graph Enrichment

AI may propose graph changes but should not silently create authoritative causal relationships. Proposed relationships require:

- Source evidence.
- Confidence.
- Review status.
- Relationship type.
- Expiration or revalidation policy.

## Model Registry

Track:

- Model provider.
- Model name.
- Version.
- Approved use cases.
- Risk limits.
- Cost profile.
- Latency profile.
- Evaluation results.
- Deprecation date.

## Prompt Registry

Track:

- Prompt template.
- Version.
- Owner.
- Use case.
- Required context.
- Output schema.
- Test cases.
- Evaluation results.
- Approval state.

## Evaluation

Evaluation should cover:

- Faithfulness to evidence.
- Citation accuracy.
- Tenant isolation.
- Privacy leakage.
- Agronomic correctness.
- Tool-use correctness.
- Retrieval relevance.
- Refusal behavior.
- Calibration.
- Consistency across similar questions.

## Human-in-the-Loop

Human review should be available for:

- High-risk recommendations.
- Network artifacts.
- Tenant escalations.
- Conflicting evidence.
- Low confidence.
- Novel agronomic claims.
- Model behavior regressions.

## AI Observability

Track:

- Request volume.
- Latency.
- Cost.
- Model selection.
- Retrieval sources.
- Citation use.
- Tool calls.
- Error rates.
- User feedback.
- Escalations.
- Safety incidents.

## AI Security

Controls:

- Prompt injection detection.
- Tool permission boundaries.
- Retrieval allowlists.
- Output policy checks.
- Secret redaction.
- Sensitive data minimization.
- Tenant-aware rate limits.
- Abuse monitoring.

Banana Chat must be a governed interface, not a bypass around the platform's data access rules.
