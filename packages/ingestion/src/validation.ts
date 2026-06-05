import type { FileDescriptor, ValidationFinding } from "./types.js";
import { classifyFileKind } from "./file-kind.js";

export interface FileValidationPolicy {
  maxBytes: number;
  allowedKinds: Set<string>;
}

export const defaultFileValidationPolicy: FileValidationPolicy = {
  maxBytes: 250 * 1024 * 1024,
  allowedKinds: new Set(["SPREADSHEET", "PDF", "IMAGE", "DOCUMENT", "TEXT", "OTHER"])
};

export function validateFileDescriptor(
  file: FileDescriptor,
  policy: FileValidationPolicy = defaultFileValidationPolicy
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const kind = classifyFileKind(file);

  if (!file.filename.trim()) {
    findings.push({
      severity: "ERROR",
      code: "filename_required",
      message: "A file name is required."
    });
  }

  if (file.byteSize !== undefined && file.byteSize > policy.maxBytes) {
    findings.push({
      severity: "ERROR",
      code: "file_too_large",
      message: `File exceeds the maximum allowed size of ${policy.maxBytes} bytes.`
    });
  }

  if (!policy.allowedKinds.has(kind)) {
    findings.push({
      severity: "ERROR",
      code: "file_kind_not_allowed",
      message: `File kind ${kind} is not allowed.`
    });
  }

  return findings;
}

export function summarizeValidation(findings: ValidationFinding[]): Record<string, unknown> {
  return {
    issueCount: findings.length,
    errorCount: findings.filter((finding) => finding.severity === "ERROR").length,
    warningCount: findings.filter((finding) => finding.severity === "WARNING").length,
    infoCount: findings.filter((finding) => finding.severity === "INFO").length,
    validatedAt: new Date().toISOString()
  };
}
