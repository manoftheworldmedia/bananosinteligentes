import type { FileAssetKind, FileDescriptor, ParsedFileResult, ParsedField } from "./types.js";
import { classifyFileKind, extensionOf } from "./file-kind.js";
import { extractBaseMetadata } from "./metadata.js";

export interface FileParser {
  kind: FileAssetKind;
  canParse(file: FileDescriptor): boolean;
  parse(file: FileDescriptor, bytes: Uint8Array): Promise<ParsedFileResult>;
}

export class SpreadsheetParser implements FileParser {
  kind = "SPREADSHEET" as const;

  canParse(file: FileDescriptor): boolean {
    return classifyFileKind(file) === "SPREADSHEET";
  }

  parse(file: FileDescriptor, bytes: Uint8Array): Promise<ParsedFileResult> {
    const extension = extensionOf(file.filename);
    if (extension !== ".csv" && extension !== ".tsv") {
      return Promise.resolve({
        kind: this.kind,
        metadata: {
          ...extractBaseMetadata(file),
          parserMode: "deferred-binary-spreadsheet",
          reason: "Binary spreadsheet parsing requires a production parser adapter."
        },
        fields: [],
        warnings: [
          {
            severity: "WARNING",
            code: "binary_spreadsheet_parser_deferred",
            message: "Binary spreadsheet metadata was captured; detailed cell parsing is deferred."
          }
        ]
      });
    }

    const delimiter = extension === ".tsv" ? "\t" : ",";
    const rows = decodeRows(bytes, delimiter);
    const sheets = [
      {
        name: "Sheet1",
        rowCount: rows.length,
        columnCount: Math.max(0, ...rows.map((row) => row.length)),
        fields: inferFields("Sheet1", rows)
      }
    ];

    return Promise.resolve({
      kind: this.kind,
      metadata: {
        ...extractBaseMetadata(file),
        sheetCount: sheets.length,
        sheets
      },
      fields: sheets.flatMap((sheet) => sheet.fields),
      warnings: []
    });
  }
}

export class PdfParser implements FileParser {
  kind = "PDF" as const;

  canParse(file: FileDescriptor): boolean {
    return classifyFileKind(file) === "PDF";
  }

  parse(file: FileDescriptor, bytes: Uint8Array): Promise<ParsedFileResult> {
    const text = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
    const pageHints = Array.from(text.matchAll(/\/Type\s*\/Page\b/g)).length;

    return Promise.resolve({
      kind: this.kind,
      metadata: {
        ...extractBaseMetadata(file),
        pageCountHint: pageHints || null,
        requiresOcr: true
      },
      fields: [],
      warnings: [
        {
          severity: "INFO",
          code: "pdf_ocr_recommended",
          message:
            "PDF parsing captured structural metadata; OCR should be run for text extraction."
        }
      ]
    });
  }
}

export class ImageParser implements FileParser {
  kind = "IMAGE" as const;

  canParse(file: FileDescriptor): boolean {
    return classifyFileKind(file) === "IMAGE";
  }

  parse(file: FileDescriptor, bytes: Uint8Array): Promise<ParsedFileResult> {
    return Promise.resolve({
      kind: this.kind,
      metadata: {
        ...extractBaseMetadata(file),
        signature: Array.from(bytes.slice(0, 12))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join(""),
        requiresOcr: true
      },
      fields: [],
      warnings: [
        {
          severity: "INFO",
          code: "image_ocr_recommended",
          message: "Image metadata was captured; OCR should be run when text or forms are expected."
        }
      ]
    });
  }
}

export class GenericFileParser implements FileParser {
  kind = "OTHER" as const;

  canParse(): boolean {
    return true;
  }

  parse(file: FileDescriptor): Promise<ParsedFileResult> {
    return Promise.resolve({
      kind: classifyFileKind(file),
      metadata: extractBaseMetadata(file),
      fields: [],
      warnings: [
        {
          severity: "WARNING",
          code: "parser_not_specialized",
          message: "No specialized parser was available for this file type."
        }
      ]
    });
  }
}

export const defaultParsers: FileParser[] = [
  new SpreadsheetParser(),
  new PdfParser(),
  new ImageParser(),
  new GenericFileParser()
];

export function selectParser(
  file: FileDescriptor,
  parsers: FileParser[] = defaultParsers
): FileParser {
  return parsers.find((parser) => parser.canParse(file)) ?? new GenericFileParser();
}

function inferFields(sheetName: string, rows: unknown[][]): ParsedField[] {
  const header = rows.find((row) => Array.isArray(row) && row.length > 0) ?? [];
  return header.map((value, index) => ({
    path: `${sheetName}.columns.${index}`,
    label: typeof value === "string" && value.length > 0 ? value : `Column ${index + 1}`,
    type: inferColumnType(rows.slice(1).map((row) => row[index])),
    confidence: value ? 0.8 : 0.4
  }));
}

function decodeRows(bytes: Uint8Array, delimiter: string): string[][] {
  const text = new TextDecoder("utf-8").decode(bytes);
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => parseDelimitedLine(line, delimiter));
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function inferColumnType(values: unknown[]): ParsedField["type"] {
  const sample = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (sample.length === 0) {
    return "unknown";
  }

  if (sample.every((value) => typeof value === "number")) {
    return "number";
  }

  if (sample.every((value) => value instanceof Date)) {
    return "date";
  }

  if (sample.every((value) => typeof value === "boolean")) {
    return "boolean";
  }

  return "string";
}
