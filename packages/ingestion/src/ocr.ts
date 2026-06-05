import type { FileDescriptor } from "./types.js";

export interface OcrResult {
  text: string;
  confidence: number;
  engine: string;
  metadata: Record<string, unknown>;
}

export interface OcrProvider {
  extractText(file: FileDescriptor, bytes: Uint8Array): Promise<OcrResult>;
}

export class DeferredOcrProvider implements OcrProvider {
  extractText(file: FileDescriptor, bytes: Uint8Array): Promise<OcrResult> {
    return Promise.resolve({
      text: "",
      confidence: 0,
      engine: "deferred",
      metadata: {
        filename: file.filename,
        byteLength: bytes.byteLength,
        reason: "OCR provider has not been configured for this environment."
      }
    });
  }
}
