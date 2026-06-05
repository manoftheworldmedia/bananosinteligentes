import { Prisma, type PrismaClient } from "@bananos/database";

type GraphPartition = "TENANT" | "SHARED_CONCEPT" | "INSIGHTS" | "NETWORK_PROJECTION" | "INTERNAL";
type OwnerType = "CLIENT" | "BANANOS" | "PUBLIC" | "PARTNER" | "MIXED";

export interface GraphNodeInput {
  tenantId?: string;
  insightArtifactId?: string;
  partition: GraphPartition;
  nodeType: string;
  naturalKey: string;
  idempotencyKey: string;
  label: string;
  ownerType: OwnerType;
  visibilityScope: string;
  sourceType: string;
  sourceRef: Record<string, unknown>;
  policyId?: string;
  consentGrantId?: string;
  confidenceScore?: number;
  validFrom?: Date;
  validUntil?: Date;
  observedAt?: Date;
  properties?: Record<string, unknown>;
  spatialContext?: Record<string, unknown>;
}

export interface GraphEdgeInput {
  tenantId?: string;
  partition: GraphPartition;
  edgeType: string;
  fromNodeId: string;
  toNodeId: string;
  idempotencyKey: string;
  ownerType: OwnerType;
  visibilityScope: string;
  sourceType: string;
  sourceRef: Record<string, unknown>;
  evidenceRef?: Record<string, unknown>;
  policyId?: string;
  consentGrantId?: string;
  confidenceScore?: number;
  validFrom?: Date;
  validUntil?: Date;
  observedAt?: Date;
  properties?: Record<string, unknown>;
}

export async function upsertGraphNode(prisma: PrismaClient, input: GraphNodeInput) {
  validatePartitionTenant(input.partition, input.tenantId);
  const data = graphNodeData(input);
  const node = await prisma.graphNode.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: data,
    update: {
      label: input.label,
      confidenceScore: decimal(input.confidenceScore ?? 1),
      properties: (input.properties ?? {}) as Prisma.InputJsonValue,
      spatialContext: (input.spatialContext ?? {}) as Prisma.InputJsonValue,
      status: "ACTIVE",
      ...(input.validUntil ? { validUntil: input.validUntil } : {})
    }
  });
  await createOutboxEvent(
    prisma,
    input.tenantId,
    "GraphNode",
    node.id,
    "graph.node.upserted",
    node.id
  );
  return node;
}

export async function upsertGraphEdge(prisma: PrismaClient, input: GraphEdgeInput) {
  validatePartitionTenant(input.partition, input.tenantId);
  const [fromNode, toNode] = await Promise.all([
    prisma.graphNode.findUniqueOrThrow({ where: { id: input.fromNodeId } }),
    prisma.graphNode.findUniqueOrThrow({ where: { id: input.toNodeId } })
  ]);
  enforceEdgeIsolation(fromNode.tenantId, toNode.tenantId, input);

  const edge = await prisma.graphEdge.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: graphEdgeData(input),
    update: {
      confidenceScore: decimal(input.confidenceScore ?? 1),
      properties: (input.properties ?? {}) as Prisma.InputJsonValue,
      evidenceRef: (input.evidenceRef ?? {}) as Prisma.InputJsonValue,
      status: "ACTIVE",
      ...(input.validUntil ? { validUntil: input.validUntil } : {})
    }
  });
  await createOutboxEvent(
    prisma,
    input.tenantId,
    "GraphEdge",
    edge.id,
    "graph.edge.upserted",
    edge.id
  );
  return edge;
}

export async function projectPublishedInsight(
  prisma: PrismaClient,
  insightId: string
): Promise<void> {
  const insight = await prisma.insightArtifact.findUniqueOrThrow({
    where: { id: insightId },
    include: { subjects: true, evidence: true }
  });
  if (insight.status !== "PUBLISHED") {
    throw new Error("Only published insights can be projected into the graph.");
  }
  const tenantId = insight.scope === "TENANT" ? (insight.tenantId ?? undefined) : undefined;
  const visibilityScope = insight.visibilityScope;
  const insightNode = await upsertGraphNode(prisma, {
    ...(tenantId ? { tenantId } : {}),
    insightArtifactId: insight.id,
    partition: insight.scope === "TENANT" ? "TENANT" : "INSIGHTS",
    nodeType: insight.artifactType,
    naturalKey: insight.id,
    idempotencyKey: `insight:${insight.id}`,
    label: insight.title,
    ownerType: insight.ownerType,
    visibilityScope,
    sourceType: "INSIGHT_REPOSITORY",
    sourceRef: { insightId: insight.id, version: insight.currentVersion },
    ...(insight.policyId ? { policyId: insight.policyId } : {}),
    ...(insight.consentGrantId ? { consentGrantId: insight.consentGrantId } : {}),
    confidenceScore: insight.confidenceScore.toNumber(),
    ...(insight.validFrom ? { validFrom: insight.validFrom } : {}),
    ...(insight.validUntil ? { validUntil: insight.validUntil } : {}),
    properties: {
      summary: insight.summary,
      riskLevel: insight.riskLevel,
      scope: insight.scope
    }
  });

  for (const subject of insight.subjects) {
    const subjectTenantId = insight.scope === "TENANT" ? (subject.tenantId ?? tenantId) : undefined;
    const subjectNode = await upsertGraphNode(prisma, {
      ...(subjectTenantId ? { tenantId: subjectTenantId } : {}),
      partition: insight.scope === "TENANT" ? "TENANT" : "SHARED_CONCEPT",
      nodeType: subject.entityType,
      naturalKey: subject.entityId,
      idempotencyKey: `${subjectTenantId ?? "shared"}:${subject.entityType}:${subject.entityId}`,
      label: subject.entityId,
      ownerType: insight.scope === "TENANT" ? "CLIENT" : "BANANOS",
      visibilityScope,
      sourceType: "INSIGHT_SUBJECT",
      sourceRef: { insightSubjectId: subject.id },
      properties: subject.metadata as Record<string, unknown>
    });
    await upsertGraphEdge(prisma, {
      ...(tenantId ? { tenantId } : {}),
      partition: insight.scope === "TENANT" ? "TENANT" : "INSIGHTS",
      edgeType: subject.relationship,
      fromNodeId: insightNode.id,
      toNodeId: subjectNode.id,
      idempotencyKey: `insight-subject:${insight.id}:${subject.id}`,
      ownerType: insight.ownerType,
      visibilityScope,
      sourceType: "INSIGHT_REPOSITORY",
      sourceRef: { insightId: insight.id, insightSubjectId: subject.id },
      confidenceScore: insight.confidenceScore.toNumber()
    });
  }

  for (const evidence of insight.evidence) {
    const evidenceTenantId =
      insight.scope === "TENANT" ? (evidence.tenantId ?? tenantId) : undefined;
    const evidenceNode = await upsertGraphNode(prisma, {
      ...(evidenceTenantId ? { tenantId: evidenceTenantId } : {}),
      partition: insight.scope === "TENANT" ? "TENANT" : "SHARED_CONCEPT",
      nodeType: evidence.evidenceType,
      naturalKey: evidence.id,
      idempotencyKey: `evidence:${evidence.id}`,
      label: evidence.citation ?? evidence.evidenceType,
      ownerType: evidence.ownerType,
      visibilityScope: evidence.visibilityScope,
      sourceType: "EVIDENCE_REFERENCE",
      sourceRef: { evidenceReferenceId: evidence.id },
      confidenceScore: evidence.qualityScore.toNumber(),
      ...(evidence.observedAt ? { observedAt: evidence.observedAt } : {}),
      properties: evidence.metadata as Record<string, unknown>
    });
    await upsertGraphEdge(prisma, {
      ...(tenantId ? { tenantId } : {}),
      partition: insight.scope === "TENANT" ? "TENANT" : "INSIGHTS",
      edgeType: "EVIDENCED_BY",
      fromNodeId: insightNode.id,
      toNodeId: evidenceNode.id,
      idempotencyKey: `insight-evidence:${insight.id}:${evidence.id}`,
      ownerType: insight.ownerType,
      visibilityScope,
      sourceType: "INSIGHT_REPOSITORY",
      sourceRef: { insightId: insight.id },
      evidenceRef: { evidenceReferenceId: evidence.id },
      confidenceScore: evidence.strength.toNumber()
    });
  }
}

export async function getGraphNeighborhood(
  prisma: PrismaClient,
  nodeId: string,
  visibleNodes: Prisma.GraphNodeWhereInput,
  depth = 1
): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  const safeDepth = Math.max(1, Math.min(depth, 4));
  const nodes = new Map<string, unknown>();
  const edges = new Map<string, unknown>();
  let frontier = [nodeId];

  for (let level = 0; level < safeDepth && frontier.length; level += 1) {
    const visible = await prisma.graphNode.findMany({
      where: {
        id: { in: frontier },
        AND: [visibleNodes],
        status: "ACTIVE"
      }
    });
    for (const node of visible) nodes.set(node.id, node);
    if (!visible.length) break;

    const foundEdges = await prisma.graphEdge.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { fromNodeId: { in: visible.map((node) => node.id) } },
          { toNodeId: { in: visible.map((node) => node.id) } }
        ]
      }
    });
    const candidateIds = new Set<string>();
    for (const edge of foundEdges) {
      candidateIds.add(edge.fromNodeId);
      candidateIds.add(edge.toNodeId);
    }
    const visibleCandidates = await prisma.graphNode.findMany({
      where: { id: { in: [...candidateIds] }, AND: [visibleNodes], status: "ACTIVE" }
    });
    const visibleIds = new Set(visibleCandidates.map((node) => node.id));
    const nextFrontier = visibleCandidates.map((node) => node.id).filter((id) => !nodes.has(id));
    for (const node of visibleCandidates) nodes.set(node.id, node);
    for (const edge of foundEdges) {
      if (visibleIds.has(edge.fromNodeId) && visibleIds.has(edge.toNodeId))
        edges.set(edge.id, edge);
    }
    frontier = nextFrontier;
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

function validatePartitionTenant(partition: GraphPartition, tenantId: string | undefined): void {
  if (partition === "TENANT" && !tenantId) {
    throw new Error("Tenant graph records require a tenant.");
  }
  if (partition !== "TENANT" && tenantId) {
    throw new Error("Shared graph partitions cannot carry a tenant identifier.");
  }
}

function enforceEdgeIsolation(
  fromTenantId: string | null,
  toTenantId: string | null,
  input: GraphEdgeInput
): void {
  if (fromTenantId !== toTenantId) {
    throw new Error("Graph edges cannot cross tenant and shared boundaries.");
  }
  if (fromTenantId && fromTenantId !== input.tenantId) {
    throw new Error("Graph edge tenant does not match its nodes.");
  }
}

function graphNodeData(input: GraphNodeInput): Prisma.GraphNodeUncheckedCreateInput {
  return {
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    ...(input.insightArtifactId ? { insightArtifactId: input.insightArtifactId } : {}),
    partition: input.partition,
    nodeType: input.nodeType,
    naturalKey: input.naturalKey,
    idempotencyKey: input.idempotencyKey,
    label: input.label,
    ownerType: input.ownerType,
    visibilityScope: input.visibilityScope,
    sourceType: input.sourceType,
    sourceRef: input.sourceRef as Prisma.InputJsonValue,
    ...(input.policyId ? { policyId: input.policyId } : {}),
    ...(input.consentGrantId ? { consentGrantId: input.consentGrantId } : {}),
    confidenceScore: decimal(input.confidenceScore ?? 1),
    ...(input.validFrom ? { validFrom: input.validFrom } : {}),
    ...(input.validUntil ? { validUntil: input.validUntil } : {}),
    ...(input.observedAt ? { observedAt: input.observedAt } : {}),
    properties: (input.properties ?? {}) as Prisma.InputJsonValue,
    spatialContext: (input.spatialContext ?? {}) as Prisma.InputJsonValue
  };
}

function graphEdgeData(input: GraphEdgeInput): Prisma.GraphEdgeUncheckedCreateInput {
  return {
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    partition: input.partition,
    edgeType: input.edgeType,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    idempotencyKey: input.idempotencyKey,
    ownerType: input.ownerType,
    visibilityScope: input.visibilityScope,
    sourceType: input.sourceType,
    sourceRef: input.sourceRef as Prisma.InputJsonValue,
    evidenceRef: (input.evidenceRef ?? {}) as Prisma.InputJsonValue,
    ...(input.policyId ? { policyId: input.policyId } : {}),
    ...(input.consentGrantId ? { consentGrantId: input.consentGrantId } : {}),
    confidenceScore: decimal(input.confidenceScore ?? 1),
    ...(input.validFrom ? { validFrom: input.validFrom } : {}),
    ...(input.validUntil ? { validUntil: input.validUntil } : {}),
    ...(input.observedAt ? { observedAt: input.observedAt } : {}),
    properties: (input.properties ?? {}) as Prisma.InputJsonValue
  };
}

async function createOutboxEvent(
  prisma: PrismaClient,
  tenantId: string | undefined,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  revision: string
): Promise<void> {
  await prisma.graphOutboxEvent.upsert({
    where: { idempotencyKey: `${eventType}:${revision}` },
    create: {
      ...(tenantId ? { tenantId } : {}),
      aggregateType,
      aggregateId,
      eventType,
      idempotencyKey: `${eventType}:${revision}`,
      payload: { aggregateType, aggregateId }
    },
    update: {}
  });
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
