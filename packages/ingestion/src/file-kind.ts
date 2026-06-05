import type { FileAssetKind, FileDescriptor } from "./types.js";

const spreadsheetExtensions = new Set([".csv", ".tsv", ".xls", ".xlsx", ".ods"]);
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic"]);
const textExtensions = new Set([".txt", ".json", ".ndjson", ".xml"]);
const documentExtensions = new Set([".doc", ".docx", ".rtf"]);

export function classifyFileKind(file: FileDescriptor): FileAssetKind {
  const contentType = file.contentType?.toLowerCase() ?? "";
  const extension = extensionOf(file.filename);

  if (
    spreadsheetExtensions.has(extension) ||
    contentType.includes("spreadsheet") ||
    contentType.includes("excel") ||
    contentType === "text/csv" ||
    contentType === "text/tab-separated-values"
  ) {
    return "SPREADSHEET";
  }

  if (extension === ".pdf" || contentType === "application/pdf") {
    return "PDF";
  }

  if (imageExtensions.has(extension) || contentType.startsWith("image/")) {
    return "IMAGE";
  }

  if (textExtensions.has(extension) || contentType.startsWith("text/")) {
    return "TEXT";
  }

  if (documentExtensions.has(extension)) {
    return "DOCUMENT";
  }

  return "OTHER";
}

export function extensionOf(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}
