export type FileAssetKind = "SPREADSHEET" | "PDF" | "IMAGE" | "DOCUMENT" | "TEXT" | "OTHER";

export type ProcessingJobType =
  | "METADATA_EXTRACTION"
  | "OCR"
  | "PARSE_SPREADSHEET"
  | "PARSE_PDF"
  | "PARSE_IMAGE"
  | "VALIDATE_FILE"
  | "CREATE_DATASET";

export type ValidationSeverity = "INFO" | "WARNING" | "ERROR";

export interface FileDescriptor {
  filename: string;
  contentType?: string;
  byteSize?: number;
  checksum?: string;
}

export interface ParsedFileResult {
  kind: FileAssetKind;
  metadata: Record<string, unknown>;
  fields: ParsedField[];
  warnings: ValidationFinding[];
}

export interface ParsedField {
  path: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "unknown";
  confidence: number;
}

export interface ValidationFinding {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestionJobPayload {
  tenantId: string;
  fileAssetId?: string;
  datasetId?: string;
  jobId?: string;
  type: ProcessingJobType;
  objectKey?: string;
}

export interface UploadSessionFile {
  filename: string;
  contentType?: string;
  byteSize?: number;
  checksum?: string;
  sourceLabel?: string;
}
