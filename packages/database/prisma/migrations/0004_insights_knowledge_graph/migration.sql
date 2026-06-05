CREATE TYPE "InsightArtifactType" AS ENUM ('FINDING', 'RECOMMENDATION', 'FORECAST', 'BENCHMARK', 'RISK_SCORE', 'PLAYBOOK', 'HYPOTHESIS', 'EXPERIMENT_RESULT', 'ALERT', 'MODEL_EVALUATION');
CREATE TYPE "InsightScope" AS ENUM ('TENANT', 'COHORT', 'NETWORK', 'GLOBAL', 'INTERNAL');
CREATE TYPE "InsightStatus" AS ENUM ('DRAFT', 'GENERATED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'DEPRECATED', 'RECALLED', 'ARCHIVED');
CREATE TYPE "InsightRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "InsightGenerationMethod" AS ENUM ('HUMAN_AUTHORED', 'RULE_BASED', 'STATISTICAL', 'MODEL_GENERATED', 'HYBRID', 'NETWORK_AGGREGATION');
CREATE TYPE "InsightReviewDecision" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'RECALLED');
CREATE TYPE "EvidenceType" AS ENUM ('CANONICAL_RECORD', 'AGGREGATED_METRIC', 'GRAPH_PATH', 'PRIOR_INSIGHT', 'PUBLIC_RESEARCH', 'EXPERT_NOTE', 'MODEL_OUTPUT', 'EXPERIMENT_RESULT', 'WEATHER_DATA', 'GEOSPATIAL_DATA');
CREATE TYPE "RevocationBehavior" AS ENUM ('RETAIN_TENANT_ONLY', 'RECOMPUTE', 'REDACT', 'RECALL', 'ARCHIVE');
CREATE TYPE "GraphPartition" AS ENUM ('TENANT', 'SHARED_CONCEPT', 'INSIGHTS', 'NETWORK_PROJECTION', 'INTERNAL');
CREATE TYPE "GraphRecordStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'DEPRECATED', 'RECALLED', 'ARCHIVED');
CREATE TYPE "GraphProposalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');
CREATE TYPE "GraphProjectionStatus" AS ENUM ('DRAFT', 'BUILDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "GraphOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

CREATE TABLE "insight_artifacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "artifact_type" "InsightArtifactType" NOT NULL,
  "scope" "InsightScope" NOT NULL,
  "status" "InsightStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "owner_type" "ObjectOwnerType" NOT NULL DEFAULT 'BANANOS',
  "visibility_scope" TEXT NOT NULL,
  "cohort_id" TEXT,
  "confidence_score" DECIMAL(5,4) NOT NULL DEFAULT 0,
  "confidence_rationale" TEXT,
  "impact_estimate" JSONB NOT NULL DEFAULT '{}',
  "risk_level" "InsightRiskLevel" NOT NULL DEFAULT 'LOW',
  "generation_method" "InsightGenerationMethod" NOT NULL,
  "model_id" TEXT,
  "prompt_version" TEXT,
  "review_required" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMP(3),
  "valid_from" TIMESTAMP(3),
  "valid_until" TIMESTAMP(3),
  "supersedes_insight_id" UUID,
  "policy_id" UUID,
  "consent_grant_id" UUID,
  "consent_basis" JSONB NOT NULL DEFAULT '{}',
  "revocation_behavior" "RevocationBehavior" NOT NULL DEFAULT 'RECALL',
  "current_version" INTEGER NOT NULL DEFAULT 1,
  "created_by" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "insight_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "insight_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "insight_artifact_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "structured_claims" JSONB NOT NULL DEFAULT '[]',
  "recommendations" JSONB NOT NULL DEFAULT '[]',
  "content" JSONB NOT NULL DEFAULT '{}',
  "content_hash" TEXT NOT NULL,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "insight_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence_references" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "insight_artifact_id" UUID NOT NULL,
  "insight_version_id" UUID,
  "tenant_id" UUID,
  "evidence_type" "EvidenceType" NOT NULL,
  "source_ref" JSONB NOT NULL,
  "owner_type" "ObjectOwnerType" NOT NULL,
  "visibility_scope" TEXT NOT NULL,
  "strength" DECIMAL(5,4) NOT NULL DEFAULT 0,
  "quality_score" DECIMAL(5,4) NOT NULL DEFAULT 0,
  "observed_at" TIMESTAMP(3),
  "citation" TEXT,
  "policy_id" UUID,
  "consent_grant_id" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_references_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "insight_subjects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "insight_artifact_id" UUID NOT NULL,
  "tenant_id" UUID,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "relationship" TEXT NOT NULL DEFAULT 'SUBJECT',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "insight_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "insight_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "insight_artifact_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "decision" "InsightReviewDecision" NOT NULL,
  "reviewer_id" UUID,
  "notes" TEXT,
  "checklist" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "insight_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "insight_contributions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "insight_artifact_id" UUID NOT NULL,
  "tenant_id" UUID,
  "contribution_ref" JSONB NOT NULL,
  "weight" DECIMAL(5,4) NOT NULL DEFAULT 0,
  "consent_grant_id" UUID,
  "revocation_behavior" "RevocationBehavior" NOT NULL,
  "anonymized" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "insight_contributions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "graph_nodes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "insight_artifact_id" UUID,
  "partition" "GraphPartition" NOT NULL,
  "status" "GraphRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "node_type" TEXT NOT NULL,
  "natural_key" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "owner_type" "ObjectOwnerType" NOT NULL,
  "visibility_scope" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_ref" JSONB NOT NULL,
  "policy_id" UUID,
  "consent_grant_id" UUID,
  "confidence_score" DECIMAL(5,4) NOT NULL DEFAULT 1,
  "valid_from" TIMESTAMP(3),
  "valid_until" TIMESTAMP(3),
  "observed_at" TIMESTAMP(3),
  "properties" JSONB NOT NULL DEFAULT '{}',
  "spatial_context" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "graph_nodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "graph_edges" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "partition" "GraphPartition" NOT NULL,
  "status" "GraphRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "edge_type" TEXT NOT NULL,
  "from_node_id" UUID NOT NULL,
  "to_node_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "owner_type" "ObjectOwnerType" NOT NULL,
  "visibility_scope" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_ref" JSONB NOT NULL,
  "evidence_ref" JSONB NOT NULL DEFAULT '{}',
  "policy_id" UUID,
  "consent_grant_id" UUID,
  "confidence_score" DECIMAL(5,4) NOT NULL DEFAULT 1,
  "valid_from" TIMESTAMP(3),
  "valid_until" TIMESTAMP(3),
  "observed_at" TIMESTAMP(3),
  "properties" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "graph_change_proposals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "partition" "GraphPartition" NOT NULL,
  "proposal_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "confidence_score" DECIMAL(5,4) NOT NULL DEFAULT 0,
  "proposed_by" UUID,
  "model_id" TEXT,
  "prompt_version" TEXT,
  "decision" "GraphProposalDecision" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" UUID,
  "review_notes" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_change_proposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "graph_projections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "name" TEXT NOT NULL,
  "partition" "GraphPartition" NOT NULL,
  "status" "GraphProjectionStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility_scope" TEXT NOT NULL,
  "query_definition" JSONB NOT NULL,
  "privacy_controls" JSONB NOT NULL DEFAULT '{}',
  "node_count" INTEGER NOT NULL DEFAULT 0,
  "edge_count" INTEGER NOT NULL DEFAULT 0,
  "built_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "graph_projections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "graph_outbox_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "GraphOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "insight_artifacts_tenant_id_status_idx" ON "insight_artifacts"("tenant_id", "status");
CREATE INDEX "insight_artifacts_scope_status_published_at_idx" ON "insight_artifacts"("scope", "status", "published_at");
CREATE INDEX "insight_artifacts_artifact_type_risk_level_idx" ON "insight_artifacts"("artifact_type", "risk_level");
CREATE UNIQUE INDEX "insight_versions_insight_artifact_id_version_key" ON "insight_versions"("insight_artifact_id", "version");
CREATE INDEX "insight_versions_content_hash_idx" ON "insight_versions"("content_hash");
CREATE INDEX "evidence_references_insight_artifact_id_evidence_type_idx" ON "evidence_references"("insight_artifact_id", "evidence_type");
CREATE INDEX "evidence_references_tenant_id_visibility_scope_idx" ON "evidence_references"("tenant_id", "visibility_scope");
CREATE UNIQUE INDEX "insight_subjects_insight_artifact_id_entity_type_entity_id_relationship_key" ON "insight_subjects"("insight_artifact_id", "entity_type", "entity_id", "relationship");
CREATE INDEX "insight_subjects_tenant_id_entity_type_entity_id_idx" ON "insight_subjects"("tenant_id", "entity_type", "entity_id");
CREATE INDEX "insight_reviews_insight_artifact_id_created_at_idx" ON "insight_reviews"("insight_artifact_id", "created_at");
CREATE INDEX "insight_contributions_tenant_id_consent_grant_id_idx" ON "insight_contributions"("tenant_id", "consent_grant_id");
CREATE INDEX "insight_contributions_insight_artifact_id_idx" ON "insight_contributions"("insight_artifact_id");
CREATE UNIQUE INDEX "graph_nodes_idempotency_key_key" ON "graph_nodes"("idempotency_key");
CREATE INDEX "graph_nodes_tenant_id_partition_node_type_idx" ON "graph_nodes"("tenant_id", "partition", "node_type");
CREATE INDEX "graph_nodes_natural_key_idx" ON "graph_nodes"("natural_key");
CREATE INDEX "graph_nodes_insight_artifact_id_idx" ON "graph_nodes"("insight_artifact_id");
CREATE UNIQUE INDEX "graph_edges_idempotency_key_key" ON "graph_edges"("idempotency_key");
CREATE INDEX "graph_edges_tenant_id_partition_edge_type_idx" ON "graph_edges"("tenant_id", "partition", "edge_type");
CREATE INDEX "graph_edges_from_node_id_edge_type_idx" ON "graph_edges"("from_node_id", "edge_type");
CREATE INDEX "graph_edges_to_node_id_edge_type_idx" ON "graph_edges"("to_node_id", "edge_type");
CREATE INDEX "graph_change_proposals_tenant_id_decision_idx" ON "graph_change_proposals"("tenant_id", "decision");
CREATE INDEX "graph_change_proposals_partition_decision_idx" ON "graph_change_proposals"("partition", "decision");
CREATE INDEX "graph_projections_tenant_id_status_idx" ON "graph_projections"("tenant_id", "status");
CREATE INDEX "graph_projections_partition_status_idx" ON "graph_projections"("partition", "status");
CREATE UNIQUE INDEX "graph_outbox_events_idempotency_key_key" ON "graph_outbox_events"("idempotency_key");
CREATE INDEX "graph_outbox_events_status_available_at_idx" ON "graph_outbox_events"("status", "available_at");
CREATE INDEX "graph_outbox_events_tenant_id_aggregate_type_idx" ON "graph_outbox_events"("tenant_id", "aggregate_type");

ALTER TABLE "insight_artifacts" ADD CONSTRAINT "insight_artifacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insight_versions" ADD CONSTRAINT "insight_versions_insight_artifact_id_fkey" FOREIGN KEY ("insight_artifact_id") REFERENCES "insight_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_references" ADD CONSTRAINT "evidence_references_insight_artifact_id_fkey" FOREIGN KEY ("insight_artifact_id") REFERENCES "insight_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_references" ADD CONSTRAINT "evidence_references_insight_version_id_fkey" FOREIGN KEY ("insight_version_id") REFERENCES "insight_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "insight_subjects" ADD CONSTRAINT "insight_subjects_insight_artifact_id_fkey" FOREIGN KEY ("insight_artifact_id") REFERENCES "insight_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insight_reviews" ADD CONSTRAINT "insight_reviews_insight_artifact_id_fkey" FOREIGN KEY ("insight_artifact_id") REFERENCES "insight_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insight_contributions" ADD CONSTRAINT "insight_contributions_insight_artifact_id_fkey" FOREIGN KEY ("insight_artifact_id") REFERENCES "insight_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_insight_artifact_id_fkey" FOREIGN KEY ("insight_artifact_id") REFERENCES "insight_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "graph_change_proposals" ADD CONSTRAINT "graph_change_proposals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "graph_projections" ADD CONSTRAINT "graph_projections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "graph_outbox_events" ADD CONSTRAINT "graph_outbox_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
