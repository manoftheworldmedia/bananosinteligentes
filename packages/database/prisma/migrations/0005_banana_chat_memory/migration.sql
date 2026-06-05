CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');
CREATE TYPE "ChatMessageRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL');
CREATE TYPE "ChatMessageStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'BLOCKED');
CREATE TYPE "AiRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "AiTraceStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'BLOCKED');
CREATE TYPE "ToolInvocationStatus" AS ENUM ('REQUESTED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DENIED');
CREATE TYPE "MemoryType" AS ENUM ('CONVERSATION', 'USER', 'TENANT', 'ENTITY', 'AGRONOMIC', 'NETWORK');
CREATE TYPE "MemoryScope" AS ENUM ('SESSION', 'USER', 'ROLE', 'TEAM', 'FARM', 'BLOCK', 'CROP_CYCLE', 'TENANT', 'COHORT', 'NETWORK', 'GLOBAL');
CREATE TYPE "MemoryValidationStatus" AS ENUM ('PENDING', 'VALIDATED', 'STALE', 'CONFLICTED', 'REVOKED', 'DELETED');
CREATE TYPE "ReportArtifactStatus" AS ENUM ('REQUESTED', 'GENERATING', 'READY', 'FAILED', 'ARCHIVED');

CREATE TABLE "conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "purpose" TEXT,
  "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
  "entity_context" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "user_id" UUID,
  "role" "ChatMessageRole" NOT NULL,
  "status" "ChatMessageStatus" NOT NULL DEFAULT 'PENDING',
  "content" TEXT NOT NULL,
  "structured_content" JSONB NOT NULL DEFAULT '{}',
  "risk_level" "AiRiskLevel" NOT NULL DEFAULT 'LOW',
  "confidence_score" DECIMAL(5,4),
  "assumptions" JSONB NOT NULL DEFAULT '[]',
  "recommended_actions" JSONB NOT NULL DEFAULT '[]',
  "escalation" JSONB NOT NULL DEFAULT '{}',
  "error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_file_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "file_asset_id" UUID NOT NULL,
  "attached_by" UUID,
  "purpose" TEXT NOT NULL DEFAULT 'analysis',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_file_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "memory_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "user_id" UUID,
  "conversation_id" UUID,
  "memory_type" "MemoryType" NOT NULL,
  "scope" "MemoryScope" NOT NULL,
  "content" TEXT NOT NULL,
  "structured_values" JSONB NOT NULL DEFAULT '{}',
  "source_ref" JSONB NOT NULL,
  "owner_type" "ObjectOwnerType" NOT NULL,
  "visibility_scope" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "confidence_score" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
  "consent_grant_id" UUID,
  "retention_policy_id" UUID,
  "retrieval_policy_id" UUID,
  "validation_status" "MemoryValidationStatus" NOT NULL DEFAULT 'PENDING',
  "sensitive" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),
  "created_by" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "memory_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_traces" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "conversation_id" UUID,
  "message_id" UUID,
  "user_id" UUID,
  "status" "AiTraceStatus" NOT NULL DEFAULT 'STARTED',
  "intent" TEXT NOT NULL,
  "risk_level" "AiRiskLevel" NOT NULL,
  "provider_key" TEXT,
  "model_key" TEXT,
  "prompt_template_key" TEXT,
  "prompt_version" TEXT,
  "retrieval_summary" JSONB NOT NULL DEFAULT '{}',
  "policy_decision" JSONB NOT NULL DEFAULT '{}',
  "output_validation" JSONB NOT NULL DEFAULT '{}',
  "latency_ms" INTEGER,
  "error_code" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "ai_traces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retrieval_citations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "ai_trace_id" UUID,
  "memory_entry_id" UUID,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "visibility_scope" TEXT NOT NULL,
  "confidence_score" DECIMAL(5,4) NOT NULL DEFAULT 0,
  "source_ref" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retrieval_citations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tool_invocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "ai_trace_id" UUID,
  "message_id" UUID,
  "user_id" UUID,
  "tool_key" TEXT NOT NULL,
  "status" "ToolInvocationStatus" NOT NULL DEFAULT 'REQUESTED',
  "permission_required" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "output" JSONB NOT NULL DEFAULT '{}',
  "error_code" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tool_invocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_artifacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "conversation_id" UUID,
  "message_id" UUID,
  "requested_by" UUID,
  "title" TEXT NOT NULL,
  "report_type" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'json',
  "status" "ReportArtifactStatus" NOT NULL DEFAULT 'REQUESTED',
  "content" JSONB NOT NULL DEFAULT '{}',
  "object_key" TEXT,
  "source_refs" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "report_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prompt_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "use_case" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "required_context" JSONB NOT NULL DEFAULT '[]',
  "output_schema" JSONB NOT NULL DEFAULT '{}',
  "risk_limit" "AiRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "provider_key" TEXT NOT NULL,
  "model_key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "approved_use_cases" TEXT[] NOT NULL,
  "maximum_risk" "AiRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "cost_profile" JSONB NOT NULL DEFAULT '{}',
  "latency_profile" JSONB NOT NULL DEFAULT '{}',
  "evaluation_summary" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "model_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_tenant_id_owner_user_id_updated_at_idx" ON "conversations"("tenant_id", "owner_user_id", "updated_at");
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");
CREATE INDEX "chat_messages_tenant_id_user_id_created_at_idx" ON "chat_messages"("tenant_id", "user_id", "created_at");
CREATE UNIQUE INDEX "chat_file_attachments_conversation_id_file_asset_id_key" ON "chat_file_attachments"("conversation_id", "file_asset_id");
CREATE INDEX "chat_file_attachments_file_asset_id_idx" ON "chat_file_attachments"("file_asset_id");
CREATE INDEX "memory_entries_tenant_id_scope_validation_status_idx" ON "memory_entries"("tenant_id", "scope", "validation_status");
CREATE INDEX "memory_entries_user_id_scope_validation_status_idx" ON "memory_entries"("user_id", "scope", "validation_status");
CREATE INDEX "memory_entries_entity_type_entity_id_idx" ON "memory_entries"("entity_type", "entity_id");
CREATE INDEX "ai_traces_tenant_id_started_at_idx" ON "ai_traces"("tenant_id", "started_at");
CREATE INDEX "ai_traces_conversation_id_started_at_idx" ON "ai_traces"("conversation_id", "started_at");
CREATE INDEX "retrieval_citations_message_id_source_type_idx" ON "retrieval_citations"("message_id", "source_type");
CREATE INDEX "retrieval_citations_ai_trace_id_idx" ON "retrieval_citations"("ai_trace_id");
CREATE INDEX "tool_invocations_tenant_id_created_at_idx" ON "tool_invocations"("tenant_id", "created_at");
CREATE INDEX "tool_invocations_ai_trace_id_idx" ON "tool_invocations"("ai_trace_id");
CREATE INDEX "report_artifacts_tenant_id_created_at_idx" ON "report_artifacts"("tenant_id", "created_at");
CREATE INDEX "report_artifacts_conversation_id_idx" ON "report_artifacts"("conversation_id");
CREATE UNIQUE INDEX "prompt_templates_tenant_id_key_version_key" ON "prompt_templates"("tenant_id", "key", "version");
CREATE INDEX "prompt_templates_key_status_idx" ON "prompt_templates"("key", "status");
CREATE UNIQUE INDEX "model_profiles_tenant_id_provider_key_model_key_key" ON "model_profiles"("tenant_id", "provider_key", "model_key");
CREATE INDEX "model_profiles_status_maximum_risk_idx" ON "model_profiles"("status", "maximum_risk");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_file_attachments" ADD CONSTRAINT "chat_file_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_file_attachments" ADD CONSTRAINT "chat_file_attachments_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_traces" ADD CONSTRAINT "ai_traces_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_traces" ADD CONSTRAINT "ai_traces_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_traces" ADD CONSTRAINT "ai_traces_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_traces" ADD CONSTRAINT "ai_traces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retrieval_citations" ADD CONSTRAINT "retrieval_citations_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retrieval_citations" ADD CONSTRAINT "retrieval_citations_ai_trace_id_fkey" FOREIGN KEY ("ai_trace_id") REFERENCES "ai_traces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retrieval_citations" ADD CONSTRAINT "retrieval_citations_memory_entry_id_fkey" FOREIGN KEY ("memory_entry_id") REFERENCES "memory_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_ai_trace_id_fkey" FOREIGN KEY ("ai_trace_id") REFERENCES "ai_traces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_artifacts" ADD CONSTRAINT "report_artifacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_artifacts" ADD CONSTRAINT "report_artifacts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_artifacts" ADD CONSTRAINT "report_artifacts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_artifacts" ADD CONSTRAINT "report_artifacts_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_profiles" ADD CONSTRAINT "model_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
