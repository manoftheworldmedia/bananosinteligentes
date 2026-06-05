import type { PrismaClient } from "@bananos/database";

export interface UsageWindow {
  tenantId?: string;
  userId?: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface ClientUsageWindow extends UsageWindow {
  tenantId: string;
}

export async function buildClientUsageSummary(
  prisma: PrismaClient,
  input: ClientUsageWindow
): Promise<Record<string, unknown>> {
  const [ledger, alerts, budget] = await Promise.all([
    prisma.clientBillableLedger.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.userId ? { userId: input.userId } : {}),
        occurredAt: {
          gte: input.periodStart,
          lt: input.periodEnd
        }
      },
      include: {
        user: true
      }
    }),
    prisma.usageAlert.findMany({
      where: {
        tenantId: input.tenantId,
        status: "OPEN"
      },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.budgetPolicy.findFirst({
      where: {
        tenantId: input.tenantId,
        enabled: true
      },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  const totalBillableUsage = sum(ledger.map((entry) => entry.clientFacingCost.toNumber()));
  const budgetAmount = budget?.budgetAmount.toNumber() ?? 0;
  const remainingBudget = Math.max(0, budgetAmount - totalBillableUsage);

  return {
    billingPeriod: {
      start: input.periodStart.toISOString(),
      end: input.periodEnd.toISOString()
    },
    totalBillableUsage,
    budgetConsumed: totalBillableUsage,
    remainingBudget,
    usageByUser: groupSum(ledger, (entry) => entry.user?.email ?? entry.userId ?? "unknown"),
    usageByFeature: groupSum(ledger, (entry) => entry.sourceFeature),
    usageByObject: groupSum(
      ledger,
      (entry) => `${entry.relatedType ?? "unknown"}:${entry.relatedId ?? "none"}`
    ),
    usageTrend: groupByDay(ledger),
    overages: ledger.filter((entry) => entry.overageStatus !== "NONE").length,
    alerts: alerts.map((alert) => ({
      status: alert.status,
      severity: alert.severity,
      code: alert.code,
      message: alert.message,
      observedValue: alert.observedValue?.toNumber() ?? null,
      createdAt: alert.createdAt.toISOString()
    }))
  };
}

export async function buildMasterMarginReport(
  prisma: PrismaClient,
  input: UsageWindow
): Promise<Record<string, unknown>> {
  const [internalLedger, billableLedger, tenants] = await Promise.all([
    prisma.internalCostLedger.findMany({
      where: {
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        occurredAt: {
          gte: input.periodStart,
          lt: input.periodEnd
        }
      },
      include: { tenant: true, user: true }
    }),
    prisma.clientBillableLedger.findMany({
      where: {
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        occurredAt: {
          gte: input.periodStart,
          lt: input.periodEnd
        }
      },
      include: { tenant: true, user: true }
    }),
    prisma.tenant.findMany()
  ]);

  const totalProviderCost = sum(internalLedger.map((entry) => entry.realInternalCost.toNumber()));
  const totalClientBillable = sum(billableLedger.map((entry) => entry.clientFacingCost.toNumber()));
  const grossMargin = totalClientBillable - totalProviderCost;
  const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const budgetRisk = await buildBudgetRisk(prisma, input, billableLedger, tenantNames);

  return {
    period: {
      start: input.periodStart.toISOString(),
      end: input.periodEnd.toISOString()
    },
    totalProviderCost,
    totalClientBillable,
    grossMargin,
    marginPercentage: totalClientBillable === 0 ? 0 : (grossMargin / totalClientBillable) * 100,
    costByProvider: groupInternal(internalLedger, (entry) => entry.actualProvider),
    costByModel: groupInternal(internalLedger, (entry) => entry.actualModel ?? "unknown"),
    costByFeature: groupInternal(internalLedger, (entry) => entry.sourceFeature),
    costByClient: groupInternal(
      internalLedger,
      (entry) => tenantNames.get(entry.tenantId) ?? entry.tenantId
    ),
    revenueByClient: groupBillable(
      billableLedger,
      (entry) => tenantNames.get(entry.tenantId) ?? entry.tenantId
    ),
    marginByClient: marginByClient(internalLedger, billableLedger, tenantNames),
    tokenUsageByClient: tokenUsageByClient(internalLedger, tenantNames),
    fileProcessingCostByClient: groupInternal(
      internalLedger.filter((entry) => entry.sourceFeature.includes("file")),
      (entry) => tenantNames.get(entry.tenantId) ?? entry.tenantId
    ),
    reportGenerationCostByClient: groupInternal(
      internalLedger.filter((entry) => entry.sourceFeature.includes("report")),
      (entry) => tenantNames.get(entry.tenantId) ?? entry.tenantId
    ),
    mostExpensiveUsers: topGroups(
      internalLedger,
      (entry) => entry.user?.email ?? entry.userId ?? "unknown"
    ),
    mostExpensiveWorkflows: topGroups(internalLedger, (entry) => entry.workflowKey ?? "unknown"),
    budgetRisk,
    anomalousUsage: anomalousUsage(internalLedger, tenantNames),
    overageExposure: groupBillable(
      billableLedger.filter((entry) => entry.overageStatus !== "NONE"),
      (entry) => tenantNames.get(entry.tenantId) ?? entry.tenantId
    ),
    providerComparison: costAndVolume(internalLedger, (entry) => entry.actualProvider),
    modelCostPerformanceComparison: costAndVolume(
      internalLedger,
      (entry) => entry.actualModel ?? "unknown"
    )
  };
}

function sum(values: number[]): number {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(6));
}

function groupSum<T extends { clientFacingCost: { toNumber(): number } }>(
  entries: T[],
  key: (entry: T) => string
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of entries) {
    const group = key(entry);
    result[group] = Number(((result[group] ?? 0) + entry.clientFacingCost.toNumber()).toFixed(6));
  }
  return result;
}

function groupBillable<T extends { clientFacingCost: { toNumber(): number } }>(
  entries: T[],
  key: (entry: T) => string
): Record<string, number> {
  return groupSum(entries, key);
}

function groupInternal<T extends { realInternalCost: { toNumber(): number } }>(
  entries: T[],
  key: (entry: T) => string
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of entries) {
    const group = key(entry);
    result[group] = Number(((result[group] ?? 0) + entry.realInternalCost.toNumber()).toFixed(6));
  }
  return result;
}

function groupByDay<T extends { occurredAt: Date; clientFacingCost: { toNumber(): number } }>(
  entries: T[]
): Array<{ date: string; amount: number }> {
  const grouped = groupSum(entries, (entry) => entry.occurredAt.toISOString().slice(0, 10));
  return Object.entries(grouped).map(([date, amount]) => ({ date, amount }));
}

function marginByClient<
  TInternal extends { tenantId: string; realInternalCost: { toNumber(): number } },
  TBillable extends { tenantId: string; clientFacingCost: { toNumber(): number } }
>(
  internalLedger: TInternal[],
  billableLedger: TBillable[],
  tenantNames: Map<string, string>
): Record<string, number> {
  const costs = groupInternal(
    internalLedger,
    (entry) => tenantNames.get(entry.tenantId) ?? entry.tenantId
  );
  const revenue = groupBillable(
    billableLedger,
    (entry) => tenantNames.get(entry.tenantId) ?? entry.tenantId
  );
  const result: Record<string, number> = {};
  for (const client of new Set([...Object.keys(costs), ...Object.keys(revenue)])) {
    result[client] = Number(((revenue[client] ?? 0) - (costs[client] ?? 0)).toFixed(6));
  }
  return result;
}

function tokenUsageByClient<
  T extends {
    tenantId: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    embeddingTokens: number;
  }
>(entries: T[], tenantNames: Map<string, string>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of entries) {
    const client = tenantNames.get(entry.tenantId) ?? entry.tenantId;
    result[client] =
      (result[client] ?? 0) +
      entry.inputTokens +
      entry.outputTokens +
      entry.cachedTokens +
      entry.embeddingTokens;
  }
  return result;
}

function topGroups<T extends { realInternalCost: { toNumber(): number } }>(
  entries: T[],
  key: (entry: T) => string
): Array<{ key: string; amount: number }> {
  return Object.entries(groupInternal(entries, key))
    .map(([groupKey, amount]) => ({ key: groupKey, amount }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 20);
}

async function buildBudgetRisk<
  T extends { tenantId: string; clientFacingCost: { toNumber(): number } }
>(
  prisma: PrismaClient,
  input: UsageWindow,
  billableLedger: T[],
  tenantNames: Map<string, string>
): Promise<
  Array<{
    client: string;
    budgetAmount: number;
    consumed: number;
    percentConsumed: number;
    capMode: string;
  }>
> {
  const budgets = await prisma.budgetPolicy.findMany({
    where: {
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      enabled: true
    }
  });
  const consumedByTenant = groupBillable(billableLedger, (entry) => entry.tenantId);
  return budgets
    .map((budget) => {
      const budgetAmount = budget.budgetAmount.toNumber();
      const consumed = consumedByTenant[budget.tenantId] ?? 0;
      return {
        client: tenantNames.get(budget.tenantId) ?? budget.tenantId,
        budgetAmount,
        consumed,
        percentConsumed:
          budgetAmount === 0 ? 0 : Number(((consumed / budgetAmount) * 100).toFixed(2)),
        capMode: budget.capMode
      };
    })
    .filter((budget) => budget.percentConsumed >= 80)
    .sort((left, right) => right.percentConsumed - left.percentConsumed);
}

function anomalousUsage<
  T extends {
    tenantId: string;
    occurredAt: Date;
    realInternalCost: { toNumber(): number };
  }
>(
  entries: T[],
  tenantNames: Map<string, string>
): Array<{ client: string; date: string; amount: number }> {
  const byClientDay = new Map<string, Record<string, number>>();
  for (const entry of entries) {
    const client = tenantNames.get(entry.tenantId) ?? entry.tenantId;
    const day = entry.occurredAt.toISOString().slice(0, 10);
    const days = byClientDay.get(client) ?? {};
    days[day] = Number(((days[day] ?? 0) + entry.realInternalCost.toNumber()).toFixed(6));
    byClientDay.set(client, days);
  }

  const anomalies: Array<{ client: string; date: string; amount: number }> = [];
  for (const [client, days] of byClientDay) {
    const values = Object.values(days);
    const average = values.length === 0 ? 0 : sum(values) / values.length;
    for (const [date, amount] of Object.entries(days)) {
      if (average > 0 && amount > average * 2) {
        anomalies.push({ client, date, amount });
      }
    }
  }
  return anomalies.sort((left, right) => right.amount - left.amount).slice(0, 20);
}

function costAndVolume<
  T extends {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    embeddingTokens: number;
    documentUnits: { toNumber(): number };
    multimodalUnits: { toNumber(): number };
    realInternalCost: { toNumber(): number };
  }
>(entries: T[], key: (entry: T) => string): Record<string, { cost: number; units: number }> {
  const result: Record<string, { cost: number; units: number }> = {};
  for (const entry of entries) {
    const group = key(entry);
    const current = result[group] ?? { cost: 0, units: 0 };
    current.cost = Number((current.cost + entry.realInternalCost.toNumber()).toFixed(6));
    current.units = Number(
      (
        current.units +
        entry.inputTokens +
        entry.outputTokens +
        entry.cachedTokens +
        entry.embeddingTokens +
        entry.documentUnits.toNumber() +
        entry.multimodalUnits.toNumber()
      ).toFixed(6)
    );
    result[group] = current;
  }
  return result;
}
