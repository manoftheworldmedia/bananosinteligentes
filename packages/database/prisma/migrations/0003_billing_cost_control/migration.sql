CREATE TYPE "BillingPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "MarkupRuleType" AS ENUM ('ORGANIZATION', 'PLAN', 'FEATURE', 'MODEL_PROVIDER', 'TOKEN_TYPE', 'FILE_PROCESSING_TYPE', 'REPORT_TYPE', 'INGESTION_TYPE', 'FIXED_MONTHLY_PLATFORM_FEE', 'USAGE_TIER', 'OVERAGE_RULE', 'ENTERPRISE_CUSTOM', 'PARTNER_PRICING');
CREATE TYPE "MarkupMethod" AS ENUM ('PERCENTAGE', 'MULTIPLIER', 'FIXED_UNIT_PRICE', 'FIXED_AMOUNT');
CREATE TYPE "UsageEventType" AS ENUM ('TOKEN', 'FILE_PROCESSING', 'REPORT', 'INSIGHT_GENERATION', 'INGESTION', 'MANUAL_ADJUSTMENT');
CREATE TYPE "BillingPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'INVOICED', 'VOID');
CREATE TYPE "BudgetCapMode" AS ENUM ('NONE', 'SOFT', 'HARD');
CREATE TYPE "UsageAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "UsageExportAudience" AS ENUM ('CLIENT', 'INTERNAL');
CREATE TYPE "LedgerEntryType" AS ENUM ('USAGE', 'CREDIT', 'REFUND', 'ADJUSTMENT', 'PLATFORM_FEE', 'COMPED', 'DEMO');
CREATE TYPE "OverageStatus" AS ENUM ('NONE', 'APPROACHING', 'OVERAGE', 'BLOCKED');

CREATE TABLE "ai_providers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_models" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "modality" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_price_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_id" UUID NOT NULL,
  "model_id" UUID,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "unit" TEXT NOT NULL,
  "input_token_price" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "output_token_price" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "cached_token_price" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "embedding_token_price" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "multimodal_unit_price" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "document_unit_price" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_until" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_price_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_billing_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" "BillingPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "plan_key" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "monthly_included_credits" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "fixed_monthly_platform_fee" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "hard_cap_amount" DECIMAL(18,6),
  "soft_cap_amount" DECIMAL(18,6),
  "partner_pricing" BOOLEAN NOT NULL DEFAULT false,
  "demo_usage_billable" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_billing_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_markup_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "billing_policy_id" UUID NOT NULL,
  "rule_type" "MarkupRuleType" NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "method" "MarkupMethod" NOT NULL,
  "value" DECIMAL(18,8) NOT NULL,
  "feature_key" TEXT,
  "provider_key" TEXT,
  "model_key" TEXT,
  "token_type" TEXT,
  "processing_type" TEXT,
  "report_type" TEXT,
  "ingestion_type" TEXT,
  "tier_from" DECIMAL(18,6),
  "tier_to" DECIMAL(18,6),
  "overage" BOOLEAN NOT NULL DEFAULT false,
  "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_until" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_markup_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID,
  "billing_policy_id" UUID,
  "event_type" "UsageEventType" NOT NULL,
  "source_feature" TEXT NOT NULL,
  "related_type" TEXT,
  "related_id" TEXT,
  "workflow_key" TEXT,
  "billable" BOOLEAN NOT NULL DEFAULT true,
  "internal_comped" BOOLEAN NOT NULL DEFAULT false,
  "demo_usage" BOOLEAN NOT NULL DEFAULT false,
  "partner_usage" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "token_usage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "usage_event_id" UUID NOT NULL,
  "provider_key" TEXT NOT NULL,
  "model_key" TEXT NOT NULL,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "cached_tokens" INTEGER NOT NULL DEFAULT 0,
  "embedding_tokens" INTEGER NOT NULL DEFAULT 0,
  "multimodal_units" DECIMAL(18,6) NOT NULL DEFAULT 0,
  CONSTRAINT "token_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "file_processing_usage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "usage_event_id" UUID NOT NULL,
  "processing_type" TEXT NOT NULL,
  "file_asset_id" UUID,
  "bytes_processed" BIGINT NOT NULL DEFAULT 0,
  "page_count" INTEGER NOT NULL DEFAULT 0,
  "document_units" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ocr_units" DECIMAL(18,6) NOT NULL DEFAULT 0,
  CONSTRAINT "file_processing_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_usage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "usage_event_id" UUID NOT NULL,
  "report_type" TEXT NOT NULL,
  "page_count" INTEGER NOT NULL DEFAULT 0,
  "export_format" TEXT,
  CONSTRAINT "report_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "insight_generation_usage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "usage_event_id" UUID NOT NULL,
  "insight_type" TEXT NOT NULL,
  "generated_count" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "insight_generation_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_rollups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "source_feature" TEXT,
  "user_id" UUID,
  "total_internal_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "total_billable_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "total_input_tokens" BIGINT NOT NULL DEFAULT 0,
  "total_output_tokens" BIGINT NOT NULL DEFAULT 0,
  "total_file_units" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "event_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_rollups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "billing_policy_id" UUID,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "status" "BillingPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "included_credits" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "consumed_credits" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "total_billable_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "total_internal_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_line_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "billing_period_id" UUID,
  "description" TEXT NOT NULL,
  "source_feature" TEXT,
  "quantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "unit_price" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_usage_summaries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "billing_period_id" UUID,
  "total_billable_usage" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "budget_consumed" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "remaining_budget" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "overage_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "usage_by_user" JSONB NOT NULL DEFAULT '{}',
  "usage_by_feature" JSONB NOT NULL DEFAULT '{}',
  "usage_by_object" JSONB NOT NULL DEFAULT '{}',
  "usage_trend" JSONB NOT NULL DEFAULT '[]',
  "alerts" JSONB NOT NULL DEFAULT '[]',
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_usage_summaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "internal_cost_ledger" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "usage_event_id" UUID NOT NULL,
  "provider_id" UUID,
  "model_id" UUID,
  "actual_provider" TEXT NOT NULL,
  "actual_model" TEXT,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "cached_tokens" INTEGER NOT NULL DEFAULT 0,
  "embedding_tokens" INTEGER NOT NULL DEFAULT 0,
  "multimodal_units" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "document_units" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "provider_unit_cost" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "real_internal_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "source_feature" TEXT NOT NULL,
  "user_id" UUID,
  "related_type" TEXT,
  "related_id" TEXT,
  "workflow_key" TEXT,
  "internal_notes" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "internal_cost_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_billable_ledger" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "usage_event_id" UUID NOT NULL,
  "billing_policy_id" UUID,
  "markup_rule_id" UUID,
  "invoice_line_item_id" UUID,
  "billable_units" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "client_unit_price" DECIMAL(18,8) NOT NULL DEFAULT 0,
  "client_facing_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "overage_status" "OverageStatus" NOT NULL DEFAULT 'NONE',
  "entry_type" "LedgerEntryType" NOT NULL DEFAULT 'USAGE',
  "source_feature" TEXT NOT NULL,
  "user_id" UUID,
  "related_type" TEXT,
  "related_id" TEXT,
  "workflow_key" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_billable_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "margin_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "billing_period_id" UUID,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "total_provider_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "total_client_billable" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "gross_margin" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "margin_percentage" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "cost_by_provider" JSONB NOT NULL DEFAULT '{}',
  "cost_by_model" JSONB NOT NULL DEFAULT '{}',
  "cost_by_feature" JSONB NOT NULL DEFAULT '{}',
  "cost_by_client" JSONB NOT NULL DEFAULT '{}',
  "revenue_by_client" JSONB NOT NULL DEFAULT '{}',
  "margin_by_client" JSONB NOT NULL DEFAULT '{}',
  "token_usage_by_client" JSONB NOT NULL DEFAULT '{}',
  "file_cost_by_client" JSONB NOT NULL DEFAULT '{}',
  "report_cost_by_client" JSONB NOT NULL DEFAULT '{}',
  "expensive_users" JSONB NOT NULL DEFAULT '[]',
  "expensive_workflows" JSONB NOT NULL DEFAULT '[]',
  "budget_risk" JSONB NOT NULL DEFAULT '[]',
  "anomalous_usage" JSONB NOT NULL DEFAULT '[]',
  "overage_exposure" JSONB NOT NULL DEFAULT '{}',
  "provider_comparison" JSONB NOT NULL DEFAULT '{}',
  "model_comparison" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "margin_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budget_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "billing_policy_id" UUID,
  "name" TEXT NOT NULL,
  "cap_mode" "BudgetCapMode" NOT NULL DEFAULT 'SOFT',
  "budget_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "alert_thresholds" JSONB NOT NULL DEFAULT '[]',
  "applies_to" JSONB NOT NULL DEFAULT '{}',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "budget_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_alerts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "budget_policy_id" UUID,
  "status" "UsageAlertStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "ValidationSeverity" NOT NULL,
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "threshold" DECIMAL(18,6),
  "observed_value" DECIMAL(18,6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "usage_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_exports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "audience" "UsageExportAudience" NOT NULL,
  "requested_by" UUID,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "object_key" TEXT,
  "format" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "filters" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "usage_exports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_providers_key_key" ON "ai_providers"("key");
CREATE UNIQUE INDEX "ai_models_provider_id_key_key" ON "ai_models"("provider_id", "key");
CREATE INDEX "provider_price_schedules_provider_id_effective_from_idx" ON "provider_price_schedules"("provider_id", "effective_from");
CREATE INDEX "provider_price_schedules_model_id_effective_from_idx" ON "provider_price_schedules"("model_id", "effective_from");
CREATE INDEX "client_billing_policies_tenant_id_status_idx" ON "client_billing_policies"("tenant_id", "status");
CREATE INDEX "client_markup_rules_billing_policy_id_rule_type_priority_idx" ON "client_markup_rules"("billing_policy_id", "rule_type", "priority");
CREATE INDEX "usage_events_tenant_id_occurred_at_idx" ON "usage_events"("tenant_id", "occurred_at");
CREATE INDEX "usage_events_tenant_id_source_feature_idx" ON "usage_events"("tenant_id", "source_feature");
CREATE INDEX "usage_events_user_id_occurred_at_idx" ON "usage_events"("user_id", "occurred_at");
CREATE UNIQUE INDEX "token_usage_events_usage_event_id_key" ON "token_usage_events"("usage_event_id");
CREATE UNIQUE INDEX "file_processing_usage_events_usage_event_id_key" ON "file_processing_usage_events"("usage_event_id");
CREATE UNIQUE INDEX "report_usage_events_usage_event_id_key" ON "report_usage_events"("usage_event_id");
CREATE UNIQUE INDEX "insight_generation_usage_events_usage_event_id_key" ON "insight_generation_usage_events"("usage_event_id");
CREATE INDEX "usage_rollups_tenant_id_period_start_period_end_idx" ON "usage_rollups"("tenant_id", "period_start", "period_end");
CREATE INDEX "billing_periods_tenant_id_period_start_period_end_idx" ON "billing_periods"("tenant_id", "period_start", "period_end");
CREATE INDEX "invoice_line_items_tenant_id_billing_period_id_idx" ON "invoice_line_items"("tenant_id", "billing_period_id");
CREATE INDEX "client_usage_summaries_tenant_id_generated_at_idx" ON "client_usage_summaries"("tenant_id", "generated_at");
CREATE UNIQUE INDEX "internal_cost_ledger_usage_event_id_key" ON "internal_cost_ledger"("usage_event_id");
CREATE INDEX "internal_cost_ledger_tenant_id_occurred_at_idx" ON "internal_cost_ledger"("tenant_id", "occurred_at");
CREATE INDEX "internal_cost_ledger_actual_provider_actual_model_idx" ON "internal_cost_ledger"("actual_provider", "actual_model");
CREATE INDEX "internal_cost_ledger_source_feature_idx" ON "internal_cost_ledger"("source_feature");
CREATE UNIQUE INDEX "client_billable_ledger_usage_event_id_key" ON "client_billable_ledger"("usage_event_id");
CREATE INDEX "client_billable_ledger_tenant_id_occurred_at_idx" ON "client_billable_ledger"("tenant_id", "occurred_at");
CREATE INDEX "client_billable_ledger_source_feature_idx" ON "client_billable_ledger"("source_feature");
CREATE INDEX "client_billable_ledger_user_id_occurred_at_idx" ON "client_billable_ledger"("user_id", "occurred_at");
CREATE INDEX "margin_reports_generated_at_idx" ON "margin_reports"("generated_at");
CREATE INDEX "budget_policies_tenant_id_enabled_idx" ON "budget_policies"("tenant_id", "enabled");
CREATE INDEX "usage_alerts_tenant_id_status_idx" ON "usage_alerts"("tenant_id", "status");
CREATE INDEX "usage_exports_tenant_id_created_at_idx" ON "usage_exports"("tenant_id", "created_at");

ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_price_schedules" ADD CONSTRAINT "provider_price_schedules_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_price_schedules" ADD CONSTRAINT "provider_price_schedules_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_billing_policies" ADD CONSTRAINT "client_billing_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_markup_rules" ADD CONSTRAINT "client_markup_rules_billing_policy_id_fkey" FOREIGN KEY ("billing_policy_id") REFERENCES "client_billing_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_billing_policy_id_fkey" FOREIGN KEY ("billing_policy_id") REFERENCES "client_billing_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "token_usage_events" ADD CONSTRAINT "token_usage_events_usage_event_id_fkey" FOREIGN KEY ("usage_event_id") REFERENCES "usage_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_processing_usage_events" ADD CONSTRAINT "file_processing_usage_events_usage_event_id_fkey" FOREIGN KEY ("usage_event_id") REFERENCES "usage_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_usage_events" ADD CONSTRAINT "report_usage_events_usage_event_id_fkey" FOREIGN KEY ("usage_event_id") REFERENCES "usage_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insight_generation_usage_events" ADD CONSTRAINT "insight_generation_usage_events_usage_event_id_fkey" FOREIGN KEY ("usage_event_id") REFERENCES "usage_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_rollups" ADD CONSTRAINT "usage_rollups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_billing_policy_id_fkey" FOREIGN KEY ("billing_policy_id") REFERENCES "client_billing_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_usage_summaries" ADD CONSTRAINT "client_usage_summaries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_usage_summaries" ADD CONSTRAINT "client_usage_summaries_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "internal_cost_ledger" ADD CONSTRAINT "internal_cost_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_cost_ledger" ADD CONSTRAINT "internal_cost_ledger_usage_event_id_fkey" FOREIGN KEY ("usage_event_id") REFERENCES "usage_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_cost_ledger" ADD CONSTRAINT "internal_cost_ledger_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "internal_cost_ledger" ADD CONSTRAINT "internal_cost_ledger_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "internal_cost_ledger" ADD CONSTRAINT "internal_cost_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_billable_ledger" ADD CONSTRAINT "client_billable_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_billable_ledger" ADD CONSTRAINT "client_billable_ledger_usage_event_id_fkey" FOREIGN KEY ("usage_event_id") REFERENCES "usage_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_billable_ledger" ADD CONSTRAINT "client_billable_ledger_billing_policy_id_fkey" FOREIGN KEY ("billing_policy_id") REFERENCES "client_billing_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_billable_ledger" ADD CONSTRAINT "client_billable_ledger_markup_rule_id_fkey" FOREIGN KEY ("markup_rule_id") REFERENCES "client_markup_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_billable_ledger" ADD CONSTRAINT "client_billable_ledger_invoice_line_item_id_fkey" FOREIGN KEY ("invoice_line_item_id") REFERENCES "invoice_line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_billable_ledger" ADD CONSTRAINT "client_billable_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "margin_reports" ADD CONSTRAINT "margin_reports_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budget_policies" ADD CONSTRAINT "budget_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budget_policies" ADD CONSTRAINT "budget_policies_billing_policy_id_fkey" FOREIGN KEY ("billing_policy_id") REFERENCES "client_billing_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "usage_alerts" ADD CONSTRAINT "usage_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_alerts" ADD CONSTRAINT "usage_alerts_budget_policy_id_fkey" FOREIGN KEY ("budget_policy_id") REFERENCES "budget_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "usage_exports" ADD CONSTRAINT "usage_exports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
