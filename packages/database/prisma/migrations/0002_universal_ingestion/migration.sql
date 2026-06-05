CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'VALIDATED', 'REJECTED', 'FAILED', 'ARCHIVED');
CREATE TYPE "FileAssetKind" AS ENUM ('SPREADSHEET', 'PDF', 'IMAGE', 'DOCUMENT', 'TEXT', 'OTHER');
CREATE TYPE "DatasetStatus" AS ENUM ('DRAFT', 'VALIDATING', 'ACTIVE', 'QUARANTINED', 'ARCHIVED');
CREATE TYPE "ProcessingJobType" AS ENUM ('METADATA_EXTRACTION', 'OCR', 'PARSE_SPREADSHEET', 'PARSE_PDF', 'PARSE_IMAGE', 'VALIDATE_FILE', 'CREATE_DATASET');
CREATE TYPE "ProcessingJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');
CREATE TYPE "ValidationSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');
CREATE TYPE "LineageEventType" AS ENUM ('UPLOADED', 'VERSION_CREATED', 'METADATA_EXTRACTED', 'OCR_COMPLETED', 'PARSED', 'VALIDATED', 'DATASET_CREATED', 'GOVERNANCE_DECISION', 'JOB_STATUS_CHANGED');

CREATE TABLE "datasets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "DatasetStatus" NOT NULL DEFAULT 'DRAFT',
  "owner_type" "ObjectOwnerType" NOT NULL,
  "visibility_scope" TEXT NOT NULL,
  "consent_grant_id" UUID,
  "schema_snapshot" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "file_assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "dataset_id" UUID,
  "object_record_id" UUID,
  "consent_grant_id" UUID,
  "filename" TEXT NOT NULL,
  "content_type" TEXT,
  "byte_size" BIGINT,
  "checksum" TEXT,
  "kind" "FileAssetKind" NOT NULL DEFAULT 'OTHER',
  "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "version" INTEGER NOT NULL DEFAULT 1,
  "owner_type" "ObjectOwnerType" NOT NULL,
  "data_class" "DataClass" NOT NULL DEFAULT 'RAW',
  "visibility_scope" TEXT NOT NULL,
  "source_label" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "extracted_metadata" JSONB NOT NULL DEFAULT '{}',
  "validation_summary" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "file_asset_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "file_asset_id" UUID NOT NULL,
  "object_record_id" UUID,
  "version" INTEGER NOT NULL,
  "checksum" TEXT,
  "byte_size" BIGINT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "file_asset_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "processing_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "file_asset_id" UUID,
  "dataset_id" UUID,
  "type" "ProcessingJobType" NOT NULL,
  "status" "ProcessingJobStatus" NOT NULL DEFAULT 'QUEUED',
  "queue_name" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "error_code" TEXT,
  "error_message" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "result" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "validation_issues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "file_asset_id" UUID,
  "dataset_id" UUID,
  "severity" "ValidationSeverity" NOT NULL,
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "path" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "validation_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lineage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "file_asset_id" UUID,
  "dataset_id" UUID,
  "event_type" "LineageEventType" NOT NULL,
  "source_ref" JSONB,
  "target_ref" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lineage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "datasets_tenant_id_status_idx" ON "datasets"("tenant_id", "status");
CREATE INDEX "file_assets_tenant_id_status_idx" ON "file_assets"("tenant_id", "status");
CREATE INDEX "file_assets_tenant_id_kind_idx" ON "file_assets"("tenant_id", "kind");
CREATE INDEX "file_assets_dataset_id_idx" ON "file_assets"("dataset_id");
CREATE UNIQUE INDEX "file_asset_versions_file_asset_id_version_key" ON "file_asset_versions"("file_asset_id", "version");
CREATE INDEX "processing_jobs_tenant_id_status_idx" ON "processing_jobs"("tenant_id", "status");
CREATE INDEX "processing_jobs_file_asset_id_idx" ON "processing_jobs"("file_asset_id");
CREATE INDEX "processing_jobs_dataset_id_idx" ON "processing_jobs"("dataset_id");
CREATE INDEX "validation_issues_tenant_id_severity_idx" ON "validation_issues"("tenant_id", "severity");
CREATE INDEX "validation_issues_file_asset_id_idx" ON "validation_issues"("file_asset_id");
CREATE INDEX "validation_issues_dataset_id_idx" ON "validation_issues"("dataset_id");
CREATE INDEX "lineage_events_tenant_id_event_type_idx" ON "lineage_events"("tenant_id", "event_type");
CREATE INDEX "lineage_events_file_asset_id_idx" ON "lineage_events"("file_asset_id");
CREATE INDEX "lineage_events_dataset_id_idx" ON "lineage_events"("dataset_id");

ALTER TABLE "datasets" ADD CONSTRAINT "datasets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_consent_grant_id_fkey" FOREIGN KEY ("consent_grant_id") REFERENCES "consent_grants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_object_record_id_fkey" FOREIGN KEY ("object_record_id") REFERENCES "object_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_consent_grant_id_fkey" FOREIGN KEY ("consent_grant_id") REFERENCES "consent_grants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "file_asset_versions" ADD CONSTRAINT "file_asset_versions_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_asset_versions" ADD CONSTRAINT "file_asset_versions_object_record_id_fkey" FOREIGN KEY ("object_record_id") REFERENCES "object_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lineage_events" ADD CONSTRAINT "lineage_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lineage_events" ADD CONSTRAINT "lineage_events_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lineage_events" ADD CONSTRAINT "lineage_events_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
