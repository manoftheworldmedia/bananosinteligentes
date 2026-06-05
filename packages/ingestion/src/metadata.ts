import type { FileDescriptor } from "./types.js";
import { classifyFileKind, extensionOf } from "./file-kind.js";

export function extractBaseMetadata(file: FileDescriptor): Record<string, unknown> {
  return {
    filename: file.filename,
    extension: extensionOf(file.filename),
    contentType: file.contentType ?? null,
    byteSize: file.byteSize ?? null,
    checksum: file.checksum ?? null,
    inferredKind: classifyFileKind(file),
    extractedAt: new Date().toISOString()
  };
}

export function createObjectKey(input: {
  tenantId: string;
  fileAssetId: string;
  version: number;
  filename: string;
}): string {
  const sanitizedFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenant/${input.tenantId}/file-assets/${input.fileAssetId}/v${input.version}/${sanitizedFilename}`;
}
