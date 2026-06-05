import { Prisma, type PrismaClient } from "@bananos/database";

export interface MeteredUsageContext {
  tenantId: string;
  userId?: string;
  sourceFeature: string;
  relatedType?: string;
  relatedId?: string;
  workflowKey?: string;
  billable?: boolean;
  internalComped?: boolean;
  demoUsage?: boolean;
  partnerUsage?: boolean;
  estimatedBillableUnits?: number;
  estimatedProviderUnitCost?: number;
  metadata?: Record<string, unknown>;
}

export interface TokenUsageMeter {
  providerKey: string;
  modelKey: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  embeddingTokens?: number;
  multimodalUnits?: number;
  providerUnitCost: number;
  realInternalCost: number;
}

export interface ProcessingUsageMeter {
  processingType: string;
  fileAssetId?: string;
  bytesProcessed?: bigint;
  pageCount?: number;
  documentUnits?: number;
  ocrUnits?: number;
  providerKey?: string;
  modelKey?: string;
  providerUnitCost: number;
  realInternalCost: number;
}

export interface ReportUsageMeter {
  reportType: string;
  pageCount?: number;
  exportFormat?: string;
  providerUnitCost: number;
  realInternalCost: number;
}

export interface InsightGenerationUsageMeter {
  insightType: string;
  generatedCount?: number;
  providerKey?: string;
  modelKey?: string;
  inputTokens?: number;
  outputTokens?: number;
  providerUnitCost: number;
  realInternalCost: number;
}

export interface MeteredAIProviderCall<TResult> {
  execute(): Promise<TResult>;
  usage(result: TResult): TokenUsageMeter;
}

export interface MeteredProcessingCall<TResult> {
  execute(): Promise<TResult>;
  usage(result: TResult): ProcessingUsageMeter;
}

export class MeteredAIClient {
  constructor(private readonly prisma: PrismaClient) {}

  async run<TResult>(
    context: MeteredUsageContext,
    call: MeteredAIProviderCall<TResult>
  ): Promise<TResult> {
    await enforceBudgetBeforeProviderCall(this.prisma, context);
    const result = await call.execute();
    await recordTokenUsage(this.prisma, context, call.usage(result));
    return result;
  }
}

export class MeteredProcessingClient {
  constructor(private readonly prisma: PrismaClient) {}

  async run<TResult>(
    context: MeteredUsageContext,
    call: MeteredProcessingCall<TResult>
  ): Promise<TResult> {
    await enforceBudgetBeforeProviderCall(this.prisma, context);
    const result = await call.execute();
    await recordFileProcessingUsage(this.prisma, context, call.usage(result));
    return result;
  }
}

export async function recordTokenUsage(
  prisma: PrismaClient,
  context: MeteredUsageContext,
  usage: TokenUsageMeter
): Promise<void> {
  await recordUsageWithLedgers(prisma, context, {
    eventType: "TOKEN",
    providerKey: usage.providerKey,
    ...(usage.modelKey ? { modelKey: usage.modelKey } : {}),
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cachedTokens: usage.cachedTokens ?? 0,
    embeddingTokens: usage.embeddingTokens ?? 0,
    multimodalUnits: usage.multimodalUnits ?? 0,
    documentUnits: 0,
    providerUnitCost: usage.providerUnitCost,
    realInternalCost: usage.realInternalCost,
    units: tokenBillableUnits(usage),
    ruleSelector: optionalRuleSelector({
      tokenType: stringMetadata(context.metadata, "tokenType")
    }),
    specialize: async (transaction, usageEventId) => {
      await transaction.tokenUsageEvent.create({
        data: {
          usageEventId,
          providerKey: usage.providerKey,
          modelKey: usage.modelKey,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cachedTokens: usage.cachedTokens ?? 0,
          embeddingTokens: usage.embeddingTokens ?? 0,
          multimodalUnits: decimal(usage.multimodalUnits ?? 0)
        }
      });
    }
  });
}

export async function recordFileProcessingUsage(
  prisma: PrismaClient,
  context: MeteredUsageContext,
  usage: ProcessingUsageMeter
): Promise<void> {
  await recordUsageWithLedgers(prisma, context, {
    eventType: "FILE_PROCESSING",
    providerKey: usage.providerKey ?? "processing",
    ...(usage.modelKey ? { modelKey: usage.modelKey } : {}),
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    embeddingTokens: 0,
    multimodalUnits: 0,
    documentUnits: usage.documentUnits ?? usage.ocrUnits ?? usage.pageCount ?? 1,
    providerUnitCost: usage.providerUnitCost,
    realInternalCost: usage.realInternalCost,
    units: usage.documentUnits ?? usage.ocrUnits ?? usage.pageCount ?? 1,
    ruleSelector: {
      processingType: usage.processingType
    },
    specialize: async (transaction, usageEventId) => {
      await transaction.fileProcessingUsageEvent.create({
        data: {
          usageEventId,
          processingType: usage.processingType,
          ...(usage.fileAssetId ? { fileAssetId: usage.fileAssetId } : {}),
          bytesProcessed: usage.bytesProcessed ?? 0n,
          pageCount: usage.pageCount ?? 0,
          documentUnits: decimal(usage.documentUnits ?? 0),
          ocrUnits: decimal(usage.ocrUnits ?? 0)
        }
      });
    }
  });
}

export async function recordReportUsage(
  prisma: PrismaClient,
  context: MeteredUsageContext,
  usage: ReportUsageMeter
): Promise<void> {
  await recordUsageWithLedgers(prisma, context, {
    eventType: "REPORT",
    providerKey: "reporting",
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    embeddingTokens: 0,
    multimodalUnits: 0,
    documentUnits: usage.pageCount ?? 1,
    providerUnitCost: usage.providerUnitCost,
    realInternalCost: usage.realInternalCost,
    units: usage.pageCount ?? 1,
    ruleSelector: {
      reportType: usage.reportType
    },
    specialize: async (transaction, usageEventId) => {
      await transaction.reportUsageEvent.create({
        data: {
          usageEventId,
          reportType: usage.reportType,
          pageCount: usage.pageCount ?? 0,
          ...(usage.exportFormat ? { exportFormat: usage.exportFormat } : {})
        }
      });
    }
  });
}

export async function recordInsightGenerationUsage(
  prisma: PrismaClient,
  context: MeteredUsageContext,
  usage: InsightGenerationUsageMeter
): Promise<void> {
  await recordUsageWithLedgers(prisma, context, {
    eventType: "INSIGHT_GENERATION",
    providerKey: usage.providerKey ?? "insight",
    ...(usage.modelKey ? { modelKey: usage.modelKey } : {}),
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cachedTokens: 0,
    embeddingTokens: 0,
    multimodalUnits: 0,
    documentUnits: usage.generatedCount ?? 1,
    providerUnitCost: usage.providerUnitCost,
    realInternalCost: usage.realInternalCost,
    units: usage.generatedCount ?? 1,
    ruleSelector: {
      insightType: usage.insightType
    },
    specialize: async (transaction, usageEventId) => {
      await transaction.insightGenerationUsageEvent.create({
        data: {
          usageEventId,
          insightType: usage.insightType,
          generatedCount: usage.generatedCount ?? 1
        }
      });
    }
  });
}

async function recordUsageWithLedgers(
  prisma: PrismaClient,
  context: MeteredUsageContext,
  input: {
    eventType: "TOKEN" | "FILE_PROCESSING" | "REPORT" | "INSIGHT_GENERATION";
    providerKey: string;
    modelKey?: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    embeddingTokens: number;
    multimodalUnits: number;
    documentUnits: number;
    providerUnitCost: number;
    realInternalCost: number;
    units: number;
    ruleSelector?: RuleSelector;
    specialize(transaction: Prisma.TransactionClient, usageEventId: string): Promise<void>;
  }
): Promise<void> {
  const billingPolicy = await prisma.clientBillingPolicy.findFirst({
    where: {
      tenantId: context.tenantId,
      status: "ACTIVE"
    },
    include: {
      markupRules: true
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  const markupRule = selectMarkupRule(billingPolicy?.markupRules ?? [], {
    sourceFeature: context.sourceFeature,
    providerKey: input.providerKey,
    ...(input.modelKey ? { modelKey: input.modelKey } : {}),
    eventType: input.eventType,
    units: input.units,
    ...(input.ruleSelector ?? {})
  });
  const billable = context.billable ?? true;
  const unitPrice = billable && !context.internalComped ? clientUnitPrice(input, markupRule) : 0;
  const clientCost = decimalNumber(unitPrice * input.units);
  const overageStatus = await resolveOverageStatus(
    prisma,
    context.tenantId,
    billingPolicy,
    clientCost
  );

  await prisma.$transaction(async (transaction) => {
    const provider = await transaction.aiProvider.findUnique({
      where: { key: input.providerKey }
    });
    const model =
      provider && input.modelKey
        ? await transaction.aiModel.findUnique({
            where: {
              providerId_key: {
                providerId: provider.id,
                key: input.modelKey
              }
            }
          })
        : null;

    const usageEvent = await transaction.usageEvent.create({
      data: {
        tenantId: context.tenantId,
        ...(context.userId ? { userId: context.userId } : {}),
        ...(billingPolicy ? { billingPolicyId: billingPolicy.id } : {}),
        eventType: input.eventType,
        sourceFeature: context.sourceFeature,
        ...(context.relatedType ? { relatedType: context.relatedType } : {}),
        ...(context.relatedId ? { relatedId: context.relatedId } : {}),
        ...(context.workflowKey ? { workflowKey: context.workflowKey } : {}),
        billable,
        internalComped: context.internalComped ?? false,
        demoUsage: context.demoUsage ?? false,
        partnerUsage: context.partnerUsage ?? false,
        metadata: (context.metadata ?? {}) as Prisma.InputJsonValue
      }
    });

    await input.specialize(transaction, usageEvent.id);

    await transaction.internalCostLedger.create({
      data: {
        tenantId: context.tenantId,
        usageEventId: usageEvent.id,
        ...(provider ? { providerId: provider.id } : {}),
        ...(model ? { modelId: model.id } : {}),
        actualProvider: input.providerKey,
        ...(input.modelKey ? { actualModel: input.modelKey } : {}),
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cachedTokens: input.cachedTokens,
        embeddingTokens: input.embeddingTokens,
        multimodalUnits: decimal(input.multimodalUnits),
        documentUnits: decimal(input.documentUnits),
        providerUnitCost: decimal(input.providerUnitCost),
        realInternalCost: decimal(input.realInternalCost),
        sourceFeature: context.sourceFeature,
        ...(context.userId ? { userId: context.userId } : {}),
        ...(context.relatedType ? { relatedType: context.relatedType } : {}),
        ...(context.relatedId ? { relatedId: context.relatedId } : {}),
        ...(context.workflowKey ? { workflowKey: context.workflowKey } : {}),
        internalNotes: {
          billable,
          partnerUsage: context.partnerUsage ?? false,
          demoUsage: context.demoUsage ?? false
        }
      }
    });

    await transaction.clientBillableLedger.create({
      data: {
        tenantId: context.tenantId,
        usageEventId: usageEvent.id,
        ...(billingPolicy ? { billingPolicyId: billingPolicy.id } : {}),
        ...(markupRule ? { markupRuleId: markupRule.id } : {}),
        billableUnits: decimal(input.units),
        clientUnitPrice: decimal(unitPrice),
        clientFacingCost: decimal(clientCost),
        overageStatus,
        entryType: context.internalComped ? "COMPED" : context.demoUsage ? "DEMO" : "USAGE",
        sourceFeature: context.sourceFeature,
        ...(context.userId ? { userId: context.userId } : {}),
        ...(context.relatedType ? { relatedType: context.relatedType } : {}),
        ...(context.relatedId ? { relatedId: context.relatedId } : {}),
        ...(context.workflowKey ? { workflowKey: context.workflowKey } : {}),
        metadata: {
          eventType: input.eventType
        }
      }
    });

    if (overageStatus !== "NONE") {
      await transaction.usageAlert.create({
        data: {
          tenantId: context.tenantId,
          severity: overageStatus === "BLOCKED" ? "ERROR" : "WARNING",
          code: `BUDGET_${overageStatus}`,
          message:
            overageStatus === "BLOCKED"
              ? "Usage has reached a configured hard budget cap."
              : "Usage is approaching or above a configured budget cap.",
          observedValue: decimal(clientCost),
          metadata: {
            sourceFeature: context.sourceFeature,
            relatedType: context.relatedType ?? null,
            relatedId: context.relatedId ?? null
          }
        }
      });
    }
  });
}

interface RuleSelector {
  tokenType?: string;
  processingType?: string;
  reportType?: string;
  ingestionType?: string;
  insightType?: string;
}

function selectMarkupRule<
  T extends {
    id: string;
    ruleType: string;
    priority: number;
    featureKey: string | null;
    providerKey: string | null;
    modelKey: string | null;
    tokenType: string | null;
    processingType: string | null;
    reportType: string | null;
    ingestionType: string | null;
    tierFrom: Prisma.Decimal | null;
    tierTo: Prisma.Decimal | null;
    effectiveUntil: Date | null;
  }
>(
  rules: T[],
  context: {
    sourceFeature: string;
    providerKey: string;
    modelKey?: string;
    eventType: string;
    units: number;
    tokenType?: string;
    processingType?: string;
    reportType?: string;
    ingestionType?: string;
    insightType?: string;
  }
): T | undefined {
  const now = Date.now();
  return [...rules]
    .filter((rule) => !rule.effectiveUntil || rule.effectiveUntil.getTime() > now)
    .filter((rule) => !rule.featureKey || rule.featureKey === context.sourceFeature)
    .filter((rule) => !rule.providerKey || rule.providerKey === context.providerKey)
    .filter((rule) => !rule.modelKey || rule.modelKey === context.modelKey)
    .filter((rule) => !rule.tokenType || rule.tokenType === context.tokenType)
    .filter((rule) => !rule.processingType || rule.processingType === context.processingType)
    .filter((rule) => !rule.reportType || rule.reportType === context.reportType)
    .filter((rule) => !rule.ingestionType || rule.ingestionType === context.ingestionType)
    .filter((rule) => !rule.tierFrom || context.units >= rule.tierFrom.toNumber())
    .filter((rule) => !rule.tierTo || context.units < rule.tierTo.toNumber())
    .sort((left, right) => left.priority - right.priority)[0];
}

function clientUnitPrice(
  input: { providerUnitCost: number },
  rule?: { method: string; value: Prisma.Decimal }
): number {
  if (!rule) {
    return input.providerUnitCost;
  }

  const value = rule.value.toNumber();
  if (rule.method === "PERCENTAGE") {
    return decimalNumber(input.providerUnitCost * (1 + value / 100));
  }

  if (rule.method === "MULTIPLIER") {
    return decimalNumber(input.providerUnitCost * value);
  }

  if (rule.method === "FIXED_UNIT_PRICE" || rule.method === "FIXED_AMOUNT") {
    return decimalNumber(value);
  }

  return input.providerUnitCost;
}

function tokenBillableUnits(usage: TokenUsageMeter): number {
  return (
    (usage.inputTokens ?? 0) +
    (usage.outputTokens ?? 0) +
    (usage.cachedTokens ?? 0) +
    (usage.embeddingTokens ?? 0) +
    (usage.multimodalUnits ?? 0)
  );
}

async function enforceBudgetBeforeProviderCall(
  prisma: PrismaClient,
  context: MeteredUsageContext
): Promise<void> {
  const billingPolicy = await prisma.clientBillingPolicy.findFirst({
    where: {
      tenantId: context.tenantId,
      status: "ACTIVE"
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  if (!billingPolicy?.hardCapAmount) {
    return;
  }

  const currentSpend = await currentMonthBillableSpend(prisma, context.tenantId);
  const estimatedSpend =
    context.estimatedBillableUnits && context.estimatedProviderUnitCost
      ? context.estimatedBillableUnits * context.estimatedProviderUnitCost
      : 0;

  if (currentSpend + estimatedSpend >= billingPolicy.hardCapAmount.toNumber()) {
    throw new Error("Hard budget cap reached. Metered provider call blocked before execution.");
  }
}

async function resolveOverageStatus(
  prisma: PrismaClient,
  tenantId: string,
  billingPolicy: {
    hardCapAmount: Prisma.Decimal | null;
    softCapAmount: Prisma.Decimal | null;
  } | null,
  nextCost: number
): Promise<"NONE" | "APPROACHING" | "OVERAGE" | "BLOCKED"> {
  const currentSpend = await currentMonthBillableSpend(prisma, tenantId);
  const projectedSpend = currentSpend + nextCost;
  if (billingPolicy?.hardCapAmount && projectedSpend >= billingPolicy.hardCapAmount.toNumber()) {
    return "BLOCKED";
  }
  if (billingPolicy?.softCapAmount && projectedSpend >= billingPolicy.softCapAmount.toNumber()) {
    return "OVERAGE";
  }
  if (
    billingPolicy?.softCapAmount &&
    projectedSpend >= billingPolicy.softCapAmount.toNumber() * 0.8
  ) {
    return "APPROACHING";
  }
  return "NONE";
}

async function currentMonthBillableSpend(prisma: PrismaClient, tenantId: string): Promise<number> {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const result = await prisma.clientBillableLedger.aggregate({
    where: {
      tenantId,
      occurredAt: {
        gte: periodStart,
        lt: now
      }
    },
    _sum: {
      clientFacingCost: true
    }
  });
  return result._sum.clientFacingCost?.toNumber() ?? 0;
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(decimalNumber(value));
}

function decimalNumber(value: number): number {
  return Number(value.toFixed(6));
}

function stringMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function optionalRuleSelector(
  input: Partial<Record<keyof RuleSelector, string | undefined>>
): RuleSelector {
  const selector: RuleSelector = {};
  if (input.tokenType) {
    selector.tokenType = input.tokenType;
  }
  if (input.processingType) {
    selector.processingType = input.processingType;
  }
  if (input.reportType) {
    selector.reportType = input.reportType;
  }
  if (input.ingestionType) {
    selector.ingestionType = input.ingestionType;
  }
  if (input.insightType) {
    selector.insightType = input.insightType;
  }
  return selector;
}
