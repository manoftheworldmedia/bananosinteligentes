import { MeteredProcessingClient } from "@bananos/billing";
import { loadConfig } from "@bananos/config";
import { prisma, type Prisma } from "@bananos/database";
import {
  DeferredOcrProvider,
  createIngestionWorker,
  extractBaseMetadata,
  selectParser,
  summarizeValidation,
  validateFileDescriptor,
  type IngestionJobPayload,
  type ValidationFinding
} from "@bananos/ingestion";
import { projectPublishedInsight } from "@bananos/knowledge-graph";
import { S3ObjectStorage } from "@bananos/object-storage";

const config = loadConfig();

const storage = new S3ObjectStorage({
  endpoint: config.OBJECT_STORAGE_ENDPOINT,
  region: config.OBJECT_STORAGE_REGION,
  bucket: config.OBJECT_STORAGE_BUCKET,
  accessKeyId: config.OBJECT_STORAGE_ACCESS_KEY,
  secretAccessKey: config.OBJECT_STORAGE_SECRET_KEY,
  forcePathStyle: config.OBJECT_STORAGE_FORCE_PATH_STYLE
});

const ocrProvider = new DeferredOcrProvider();
const meteredProcessing = new MeteredProcessingClient(prisma);

const worker = createIngestionWorker(
  {
    redisUrl: config.REDIS_URL,
    queueName: config.INGESTION_QUEUE_NAME
  },
  processIngestionJob
);

const graphOutboxTimer = setInterval(() => {
  void processGraphOutboxBatch().catch((error: unknown) => {
    console.error("graph outbox batch failed", { error });
  });
}, config.GRAPH_OUTBOX_POLL_INTERVAL_MS);
void processGraphOutboxBatch().catch((error: unknown) => {
  console.error("initial graph outbox batch failed", { error });
});

async function processGraphOutboxBatch(): Promise<void> {
  const events = await prisma.graphOutboxEvent.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      availableAt: { lte: new Date() }
    },
    orderBy: { createdAt: "asc" },
    take: config.GRAPH_OUTBOX_BATCH_SIZE
  });

  for (const event of events) {
    const claimed = await prisma.graphOutboxEvent.updateMany({
      where: {
        id: event.id,
        status: { in: ["PENDING", "FAILED"] }
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 }
      }
    });
    if (claimed.count === 0) {
      continue;
    }

    try {
      if (event.eventType === "insight.published") {
        await projectPublishedInsight(prisma, event.aggregateId);
      }
      await prisma.graphOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          lastError: null
        }
      });
    } catch (error) {
      await prisma.graphOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          availableAt: new Date(Date.now() + graphRetryDelayMs(event.attempts + 1)),
          lastError: error instanceof Error ? error.message : "Unknown graph outbox failure"
        }
      });
    }
  }
}

function graphRetryDelayMs(attempt: number): number {
  return Math.min(300_000, 1000 * 2 ** Math.min(attempt, 8));
}

async function processIngestionJob(payload: IngestionJobPayload): Promise<void> {
  if (payload.jobId) {
    await prisma.processingJob.update({
      where: { id: payload.jobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        attempts: { increment: 1 }
      }
    });
  }

  try {
    await runJob(payload);
    console.info("ingestion job completed", {
      jobId: payload.jobId,
      type: payload.type
    });

    if (payload.jobId) {
      await prisma.processingJob.update({
        where: { id: payload.jobId },
        data: {
          status: "SUCCEEDED",
          completedAt: new Date()
        }
      });
    }
  } catch (error) {
    if (payload.jobId) {
      await prisma.processingJob.update({
        where: { id: payload.jobId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorCode: "ingestion_job_failed",
          errorMessage: error instanceof Error ? error.message : "Unknown ingestion job failure"
        }
      });
    }

    console.error("ingestion job failed", {
      jobId: payload.jobId,
      type: payload.type,
      error
    });
    throw error;
  }
}

async function runJob(payload: IngestionJobPayload): Promise<void> {
  if (!payload.fileAssetId) {
    return;
  }

  const fileAsset = await prisma.fileAsset.findFirstOrThrow({
    where: {
      id: payload.fileAssetId,
      tenantId: payload.tenantId
    },
    include: {
      objectRecord: true
    }
  });

  const descriptor = {
    filename: fileAsset.filename,
    ...(fileAsset.contentType ? { contentType: fileAsset.contentType } : {}),
    ...(fileAsset.byteSize ? { byteSize: Number(fileAsset.byteSize) } : {}),
    ...(fileAsset.checksum ? { checksum: fileAsset.checksum } : {})
  };

  if (payload.type === "METADATA_EXTRACTION") {
    await prisma.fileAsset.update({
      where: { id: fileAsset.id },
      data: {
        status: "PROCESSING",
        extractedMetadata: extractBaseMetadata(descriptor) as Prisma.InputJsonValue
      }
    });

    await writeLineage(payload, "METADATA_EXTRACTED", {
      parser: "base-metadata"
    });
    return;
  }

  if (payload.type === "VALIDATE_FILE") {
    const findings = validateFileDescriptor(descriptor);
    await persistValidationFindings(payload, findings);
    await prisma.fileAsset.update({
      where: { id: fileAsset.id },
      data: {
        status: findings.some((finding) => finding.severity === "ERROR") ? "REJECTED" : "VALIDATED",
        validationSummary: summarizeValidation(findings) as Prisma.InputJsonValue
      }
    });
    await writeLineage(payload, "VALIDATED", {
      validationSummary: summarizeValidation(findings)
    });
    return;
  }

  if (payload.type === "OCR") {
    const bytes = await readObjectBytes(payload.objectKey ?? fileAsset.objectRecord?.objectKey);
    const result = await meteredProcessing.run(
      {
        tenantId: payload.tenantId,
        sourceFeature: "file.ocr",
        relatedType: "file",
        relatedId: fileAsset.id,
        workflowKey: "ingestion.ocr",
        estimatedBillableUnits: 1,
        estimatedProviderUnitCost: 0
      },
      {
        execute: () => ocrProvider.extractText(descriptor, bytes),
        usage: () => ({
          processingType: "OCR",
          fileAssetId: fileAsset.id,
          bytesProcessed: BigInt(bytes.byteLength),
          documentUnits: 1,
          ocrUnits: 1,
          providerKey: "deferred-ocr",
          providerUnitCost: 0,
          realInternalCost: 0
        })
      }
    );
    await prisma.fileAsset.update({
      where: { id: fileAsset.id },
      data: {
        extractedMetadata: {
          ...toObject(fileAsset.extractedMetadata),
          ocr: result
        } as unknown as Prisma.InputJsonValue
      }
    });
    await writeLineage(payload, "OCR_COMPLETED", {
      engine: result.engine,
      confidence: result.confidence
    });
    return;
  }

  if (
    payload.type === "PARSE_SPREADSHEET" ||
    payload.type === "PARSE_PDF" ||
    payload.type === "PARSE_IMAGE"
  ) {
    const bytes = await readObjectBytes(payload.objectKey ?? fileAsset.objectRecord?.objectKey);
    const parser = selectParser(descriptor);
    const parsed = await meteredProcessing.run(
      {
        tenantId: payload.tenantId,
        sourceFeature: "file.parser",
        relatedType: "file",
        relatedId: fileAsset.id,
        workflowKey: `ingestion.${payload.type.toLowerCase()}`,
        estimatedBillableUnits: 1,
        estimatedProviderUnitCost: 0
      },
      {
        execute: () => parser.parse(descriptor, bytes),
        usage: () => ({
          processingType: payload.type,
          fileAssetId: fileAsset.id,
          bytesProcessed: BigInt(bytes.byteLength),
          documentUnits: 1,
          providerKey: "bananos-parser",
          providerUnitCost: 0,
          realInternalCost: 0
        })
      }
    );
    await persistValidationFindings(payload, parsed.warnings);
    await prisma.fileAsset.update({
      where: { id: fileAsset.id },
      data: {
        extractedMetadata: {
          ...toObject(fileAsset.extractedMetadata),
          parsed: parsed.metadata,
          fields: parsed.fields
        } as unknown as Prisma.InputJsonValue
      }
    });
    await writeLineage(payload, "PARSED", {
      parser: parser.constructor.name,
      kind: parsed.kind,
      fieldCount: parsed.fields.length
    });
  }
}

async function readObjectBytes(objectKey: string | undefined): Promise<Uint8Array> {
  if (!objectKey) {
    throw new Error("Object key is required for file processing.");
  }

  const object = await storage.get(objectKey);
  const body = object.body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
  if (!body?.transformToByteArray) {
    throw new Error("Object body cannot be converted to bytes.");
  }

  return body.transformToByteArray();
}

async function persistValidationFindings(
  payload: IngestionJobPayload,
  findings: ValidationFinding[]
): Promise<void> {
  if (!payload.fileAssetId || findings.length === 0) {
    return;
  }

  await prisma.validationIssue.createMany({
    data: findings.map((finding) => ({
      tenantId: payload.tenantId,
      fileAssetId: payload.fileAssetId ?? null,
      ...(payload.datasetId ? { datasetId: payload.datasetId } : {}),
      severity: finding.severity,
      code: finding.code,
      message: finding.message,
      ...(finding.path ? { path: finding.path } : {}),
      metadata: (finding.metadata ?? {}) as Prisma.InputJsonValue
    }))
  });
}

async function writeLineage(
  payload: IngestionJobPayload,
  eventType: "METADATA_EXTRACTED" | "OCR_COMPLETED" | "PARSED" | "VALIDATED" | "JOB_STATUS_CHANGED",
  metadata: Record<string, unknown>
): Promise<void> {
  await prisma.lineageEvent.create({
    data: {
      tenantId: payload.tenantId,
      ...(payload.fileAssetId ? { fileAssetId: payload.fileAssetId } : {}),
      ...(payload.datasetId ? { datasetId: payload.datasetId } : {}),
      eventType,
      metadata: metadata as Prisma.InputJsonValue
    }
  });
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const shutdown = async (): Promise<void> => {
  clearInterval(graphOutboxTimer);
  await worker.close();
  await prisma.$disconnect();
};

process.once("SIGINT", () => {
  void shutdown();
});

process.once("SIGTERM", () => {
  void shutdown();
});
