import type { AuthenticatedPrincipal } from "@bananos/core";
import { Prisma, type PrismaClient } from "@bananos/database";

export interface CreateMemoryInput {
  memoryType: "CONVERSATION" | "USER" | "TENANT" | "ENTITY" | "AGRONOMIC" | "NETWORK";
  scope:
    | "SESSION"
    | "USER"
    | "ROLE"
    | "TEAM"
    | "FARM"
    | "BLOCK"
    | "CROP_CYCLE"
    | "TENANT"
    | "COHORT"
    | "NETWORK"
    | "GLOBAL";
  content: string;
  structuredValues?: Record<string, unknown>;
  sourceRef: Record<string, unknown>;
  ownerType: "CLIENT" | "BANANOS" | "PUBLIC" | "PARTNER" | "MIXED";
  visibilityScope: string;
  conversationId?: string;
  entityType?: string;
  entityId?: string;
  confidenceScore?: number;
  consentGrantId?: string;
  retentionPolicyId?: string;
  retrievalPolicyId?: string;
  expiresAt?: Date;
  sensitive?: boolean;
  explicitConfirmation?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RetrievedMemory {
  id: string;
  content: string;
  scope: string;
  confidenceScore: number;
  sourceRef: unknown;
  visibilityScope: string;
  score: number;
}

export async function createMemory(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  input: CreateMemoryInput
) {
  validateMemoryCreation(principal, input);
  return prisma.memoryEntry.create({
    data: {
      ...(tenantScoped(input.scope) ? { tenantId: principal.tenantId } : {}),
      ...(userScoped(input.scope) ? { userId: principal.principalId } : {}),
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      memoryType: input.memoryType,
      scope: input.scope,
      content: input.content,
      structuredValues: (input.structuredValues ?? {}) as Prisma.InputJsonValue,
      sourceRef: input.sourceRef as Prisma.InputJsonValue,
      ownerType: input.ownerType,
      visibilityScope: input.visibilityScope,
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      confidenceScore: decimal(input.confidenceScore ?? 0.5),
      ...(input.consentGrantId ? { consentGrantId: input.consentGrantId } : {}),
      ...(input.retentionPolicyId ? { retentionPolicyId: input.retentionPolicyId } : {}),
      ...(input.retrievalPolicyId ? { retrievalPolicyId: input.retrievalPolicyId } : {}),
      validationStatus: broadScope(input.scope) ? "PENDING" : "VALIDATED",
      sensitive: input.sensitive ?? false,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      createdBy: principal.principalId,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
    }
  });
}

export async function retrieveMemories(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  input: {
    query: string;
    conversationId?: string;
    entityType?: string;
    entityId?: string;
    take?: number;
  }
): Promise<RetrievedMemory[]> {
  const now = new Date();
  const memories = await prisma.memoryEntry.findMany({
    where: {
      validationStatus: "VALIDATED",
      AND: [
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        {
          OR: [
            {
              tenantId: principal.tenantId,
              scope: { in: ["TENANT", "FARM", "BLOCK", "CROP_CYCLE"] }
            },
            { tenantId: principal.tenantId, userId: principal.principalId, scope: "USER" },
            ...(input.conversationId
              ? [
                  {
                    tenantId: principal.tenantId,
                    conversationId: input.conversationId,
                    scope: "SESSION" as const
                  }
                ]
              : []),
            {
              tenantId: null,
              scope: { in: ["NETWORK", "GLOBAL"] },
              visibilityScope: { in: ["network", "global"] }
            }
          ]
        },
        {
          OR: [
            { sensitive: false },
            { userId: principal.principalId },
            ...(hasPermission(principal, "memory:admin") ? [{}] : [])
          ]
        },
        {
          ...(input.entityType ? { entityType: input.entityType } : {}),
          ...(input.entityId ? { entityId: input.entityId } : {})
        }
      ]
    },
    orderBy: [{ lastUsedAt: "desc" }, { confidenceScore: "desc" }],
    take: 100
  });

  const terms = queryTerms(input.query);
  const ranked = memories
    .map((memory) => ({
      id: memory.id,
      content: memory.content,
      scope: memory.scope,
      confidenceScore: memory.confidenceScore.toNumber(),
      sourceRef: memory.sourceRef,
      visibilityScope: memory.visibilityScope,
      score: lexicalScore(memory.content, terms) + memory.confidenceScore.toNumber()
    }))
    .filter((memory) => terms.length === 0 || memory.score > memory.confidenceScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.take ?? 10);

  if (ranked.length) {
    await prisma.memoryEntry.updateMany({
      where: { id: { in: ranked.map((memory) => memory.id) } },
      data: { lastUsedAt: now }
    });
  }
  return ranked;
}

export async function deleteMemory(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  memoryId: string
): Promise<void> {
  const memory = await prisma.memoryEntry.findUniqueOrThrow({ where: { id: memoryId } });
  const ownsMemory =
    memory.tenantId === principal.tenantId &&
    (memory.userId === principal.principalId || hasPermission(principal, "memory:admin"));
  if (!ownsMemory) {
    throw new Error("Memory deletion denied.");
  }
  await prisma.memoryEntry.update({
    where: { id: memoryId },
    data: {
      validationStatus: "DELETED",
      content: "[deleted]",
      structuredValues: {},
      metadata: { deletedBy: principal.principalId, deletedAt: new Date().toISOString() }
    }
  });
}

function validateMemoryCreation(principal: AuthenticatedPrincipal, input: CreateMemoryInput): void {
  if (!hasPermission(principal, "memory:create")) {
    throw new Error("Memory creation denied.");
  }
  if (broadScope(input.scope) && !input.explicitConfirmation) {
    throw new Error("Broad or durable memory requires explicit confirmation.");
  }
  if (broadScope(input.scope) && !hasPermission(principal, "memory:admin")) {
    throw new Error("Broad memory creation requires memory administration permission.");
  }
  if (input.scope === "SESSION" && !input.conversationId) {
    throw new Error("Session memory requires a conversation.");
  }
  if (
    input.confidenceScore !== undefined &&
    (input.confidenceScore < 0 || input.confidenceScore > 1)
  ) {
    throw new Error("Memory confidence must be between 0 and 1.");
  }
}

function broadScope(scope: CreateMemoryInput["scope"]): boolean {
  return ["TENANT", "COHORT", "NETWORK", "GLOBAL", "ROLE", "TEAM"].includes(scope);
}

function tenantScoped(scope: CreateMemoryInput["scope"]): boolean {
  return !["NETWORK", "GLOBAL"].includes(scope);
}

function userScoped(scope: CreateMemoryInput["scope"]): boolean {
  return ["SESSION", "USER"].includes(scope);
}

function hasPermission(principal: AuthenticatedPrincipal, permission: string): boolean {
  return principal.permissions.includes(permission) || principal.permissions.includes("*:*");
}

function queryTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 2)
    )
  ].slice(0, 20);
}

function lexicalScore(content: string, terms: string[]): number {
  const normalized = content.toLowerCase();
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
