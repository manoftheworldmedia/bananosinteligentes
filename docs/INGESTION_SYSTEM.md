# Ingestion System

## Purpose

The ingestion system is the entry point for client-owned raw operational data, partner data, public data, and human-entered observations. It must preserve source fidelity, enforce ownership and consent, evaluate data quality, and transform valid records into the Canonical Agricultural Model.

## Ingestion Principles

- Preserve raw source payloads immutably.
- Do not canonicalize data until ownership, consent, and classification are known.
- Keep source schema snapshots and mapping versions.
- Treat data quality as a first-class output.
- Make every transformation traceable.
- Support both structured and unstructured agricultural data.
- Never allow connector convenience to weaken tenant isolation.

## Source Types

### Enterprise and Farm Systems

- Farm management systems.
- ERP and accounting systems.
- Packing house systems.
- Logistics systems.
- Procurement and input inventory systems.
- Certification and compliance systems.

### Agronomic Sources

- Field scouting forms.
- Pest and disease observations.
- Soil and tissue lab reports.
- Irrigation schedules.
- Fertilization plans.
- Harvest and yield records.
- Quality inspection records.

### Environmental and Geospatial Sources

- Weather stations.
- Public weather APIs.
- Satellite imagery.
- Drone imagery.
- Soil maps.
- Terrain models.
- Flood, wind, and climate risk datasets.

### IoT and Equipment

- Irrigation telemetry.
- Pump and flow meters.
- Soil moisture probes.
- Equipment operation logs.
- Cold chain sensors.

### Documents and Human Input

- Spreadsheets.
- PDFs.
- Photos.
- Voice notes.
- Agronomist reports.
- Chat-submitted observations.

## Ingestion Flow

1. Source registration.
2. Connector authentication.
3. Consent and permitted-use binding.
4. Raw landing.
5. Schema detection or extraction.
6. Ownership and sensitivity classification.
7. Data quality validation.
8. Deduplication and identity resolution.
9. Canonical mapping.
10. Canonical entity and event upsert.
11. Lineage recording.
12. Downstream event publication.

## Source Registration

Each source should define:

- Source identity.
- Tenant ownership.
- Connector type.
- Authentication method.
- Data scopes.
- Sync schedule.
- Expected schema.
- Consent policy.
- Retention policy.
- Classification rules.
- Failure handling.
- Responsible data steward.

## Connector Patterns

- API connector.
- File drop connector.
- Spreadsheet import.
- Database replication.
- Webhook ingestion.
- Stream ingestion.
- Manual form entry.
- Document extraction.
- Image metadata extraction.
- Partner data exchange.

Connectors should be declarative where possible and versioned where custom logic is required.

## Raw Landing Zone

Raw data should be stored in tenant-scoped object storage paths:

`tenant/{tenant_id}/source/{source_id}/ingestion_date={date}/batch/{batch_id}/...`

Raw records should be immutable. Corrections should create new versions, not mutate historical payloads.

## Ingestion Metadata

Every ingestion batch should include:

- `batch_id`
- `tenant_id`
- `source_id`
- `connector_version`
- `started_at`
- `completed_at`
- `record_count`
- `raw_object_paths`
- `schema_snapshot_id`
- `quality_report_id`
- `consent_policy_id`
- `lineage_id`
- `status`

## Data Quality

Quality checks should include:

- Required field presence.
- Type validation.
- Unit validation.
- Date range validation.
- Geospatial boundary validation.
- Duplicate detection.
- Referential integrity.
- Source freshness.
- Outlier detection.
- Confidence scoring for extracted document data.

Quality results should be stored and visible to users. Low-quality data may be quarantined, partially accepted, or accepted with confidence penalties.

## Canonical Mapping

Source-to-canonical mappings must be versioned and testable.

Mapping outputs:

- Canonical entities.
- Canonical events.
- Measurement records.
- Relationship records.
- Mapping confidence.
- Unmapped fields.
- Transformation lineage.

The platform should preserve unmapped source fields for future mapping improvements.

## Identity Resolution

Agricultural identity resolution must handle:

- Farm aliases.
- Block renaming.
- Lot identifiers.
- Crop cycle changes.
- Geospatial overlaps.
- Replanted areas.
- Shared equipment.
- Supplier and worker identity ambiguity.

Identity resolution should support deterministic rules first, then probabilistic matching with human review.

## Document and Image Ingestion

Documents and images require:

- OCR or extraction pipeline.
- Field-level extraction confidence.
- Human review for low-confidence extraction.
- Source document citation anchors.
- Structured canonical mapping.
- Sensitive content classification.

Extracted facts should link back to document location and extraction model version.

## Ingestion Events

Recommended events:

- `source.registered`
- `source.credentials.updated`
- `ingestion.job.scheduled`
- `ingestion.job.started`
- `ingestion.raw_object.stored`
- `ingestion.schema.detected`
- `ingestion.quality.checked`
- `ingestion.record.quarantined`
- `canonical.mapping.applied`
- `canonical.entity.upserted`
- `ingestion.job.completed`
- `ingestion.job.failed`

## Failure Handling

The ingestion system should support:

- Retry policies.
- Dead-letter queues.
- Partial batch acceptance.
- Quarantine workflows.
- Steward notifications.
- Connector health monitoring.
- Rollback of canonical upserts from failed batches.
- Replay from immutable raw data.

## Downstream Consumers

Ingestion feeds:

- Canonical warehouse.
- Knowledge graph.
- Insights Repository.
- Feature store.
- Search and vector indexes.
- Banana Chat retrieval.
- Data quality workbench.
- Governance audit.

Downstream consumers must receive policy and lineage context with the data.
