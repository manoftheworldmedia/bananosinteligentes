import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import {
  buildClientUsageSummary,
  buildMasterMarginReport,
  canViewClientTenantUsage,
  canViewOwnUsage,
  requireClientBillableAccess,
  requireInternalCostAccess,
  requireInternalUsageAccess
} from "@bananos/billing";
import { BananaChatOrchestrator, type BananaToolRequest } from "@bananos/banana-chat";
import { Redis } from "ioredis";
import { loadConfig } from "@bananos/config";
import { createAuditEnvelope, can, decidePolicy, type AuthenticatedPrincipal } from "@bananos/core";
import { Prisma, prisma } from "@bananos/database";
import {
  classifyFileKind,
  createObjectKey,
  enqueueIngestionJob,
  extractBaseMetadata,
  summarizeValidation,
  validateFileDescriptor,
  type ProcessingJobType,
  type UploadSessionFile,
  type ValidationFinding
} from "@bananos/ingestion";
import {
  canManageInsights,
  canReviewInsights,
  createInsight,
  createInsightVersion,
  insightVisibilityWhere,
  publishInsight,
  reviewInsight,
  type CreateInsightInput
} from "@bananos/insights";
import {
  getGraphNeighborhood,
  graphVisibilityWhere,
  projectPublishedInsight,
  upsertGraphEdge,
  upsertGraphNode,
  type GraphEdgeInput,
  type GraphNodeInput
} from "@bananos/knowledge-graph";
import {
  createMemory,
  deleteMemory,
  retrieveMemories,
  type CreateMemoryInput
} from "@bananos/memory";
import { S3ObjectStorage } from "@bananos/object-storage";

const config = loadConfig();

const app = Fastify({
  logger: {
    level: config.LOG_LEVEL
  },
  requestIdHeader: "x-request-id"
});

const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 2
});

const objectStorage = new S3ObjectStorage({
  endpoint: config.OBJECT_STORAGE_ENDPOINT,
  region: config.OBJECT_STORAGE_REGION,
  bucket: config.OBJECT_STORAGE_BUCKET,
  accessKeyId: config.OBJECT_STORAGE_ACCESS_KEY,
  secretAccessKey: config.OBJECT_STORAGE_SECRET_KEY,
  forcePathStyle: config.OBJECT_STORAGE_FORCE_PATH_STYLE
});
const bananaChat = new BananaChatOrchestrator(prisma);

await app.register(helmet);
await app.register(rateLimit, {
  max: 300,
  timeWindow: "1 minute"
});

app.get("/health", async (_request, reply) => {
  const [database, cache] = await Promise.all([checkDatabase(), checkRedis()]);
  const healthy = database.ok && cache.ok;

  if (!healthy) {
    reply.code(503);
  }

  return {
    status: healthy ? "ok" : "degraded",
    services: {
      database,
      cache
    }
  };
});

app.get("/v1/foundation/permissions", () => {
  return {
    permissions: [
      "tenant:read",
      "tenant:administer",
      "user:read",
      "user:create",
      "user:update",
      "role:read",
      "role:administer",
      "consent:read",
      "consent:administer",
      "policy:read",
      "policy:decide",
      "audit:read",
      "object:read",
      "object:create",
      "dataset:create",
      "dataset:read",
      "file_asset:create",
      "file_asset:read",
      "file_asset:update",
      "processing_job:read",
      "billing_policy:create",
      "billing_policy:update",
      "billing_policy:read",
      "markup_rule:create",
      "markup_rule:update",
      "budget_policy:create",
      "budget_policy:update",
      "usage_summary:read",
      "internal_cost:read",
      "margin_report:read",
      "usage_export:create",
      "manual_adjustment:create",
      "insight:create",
      "insight:read",
      "insight:review",
      "insight:publish",
      "insight:admin",
      "graph:read",
      "graph:write",
      "graph:review",
      "graph:admin",
      "chat:use",
      "chat:admin",
      "memory:create",
      "memory:read",
      "memory:delete",
      "memory:admin",
      "report:generate",
      "report:read"
    ]
  };
});

app.post<{
  Body: {
    principal: AuthenticatedPrincipal;
    resource: string;
    action: string;
    consentState?: "REQUESTED" | "GRANTED" | "DENIED" | "REVOKED" | "EXPIRED" | "SUSPENDED";
  };
}>("/v1/foundation/policy/decide", async (request, reply) => {
  const body = request.body;
  const rbacDecision = can({
    principalPermissions: body.principal.permissions,
    required: {
      resource: body.resource,
      action: body.action
    }
  });

  const governanceContext = {
    tenantId: body.principal.tenantId,
    resource: body.resource,
    action: body.action,
    ...(body.consentState ? { consentState: body.consentState } : {})
  };

  const governanceDecision = decidePolicy(governanceContext, [
    {
      key: "foundation-default-allow-for-authorized-principals",
      version: 1,
      status: "ACTIVE",
      effect: rbacDecision.allowed ? "ALLOW" : "DENY",
      resource: body.resource,
      action: body.action
    }
  ]);

  const allowed = rbacDecision.allowed && governanceDecision.allowed;
  const envelope = createAuditEnvelope(
    {
      tenantId: body.principal.tenantId,
      actorType: body.principal.principalType,
      actorId: body.principal.principalId,
      action: "policy.decide",
      resource: "policy",
      outcome: allowed ? "SUCCESS" : "DENIED",
      policyDecision: {
        rbacDecision,
        governanceDecision
      },
      requestId: request.id
    },
    config.AUDIT_HASH_SECRET
  );

  request.log.info({ audit: envelope }, "policy decision audited");
  return reply.code(allowed ? 200 : 403).send({
    allowed,
    rbacDecision,
    governanceDecision
  });
});

app.post<{
  Body: {
    tenantId?: string;
    actorType?: "USER" | "SERVICE_ACCOUNT";
    actorId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    outcome: "SUCCESS" | "DENIED" | "FAILURE";
    metadata?: Record<string, unknown>;
  };
}>("/v1/foundation/audit/events", async (request, reply) => {
  const auditInput = {
    ...request.body,
    requestId: request.id,
    ipAddress: request.ip,
    ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {})
  };

  const envelope = createAuditEnvelope(auditInput, config.AUDIT_HASH_SECRET);

  const auditData: Prisma.AuditEventCreateInput = {
    action: envelope.action,
    resource: envelope.resource,
    outcome: envelope.outcome,
    hash: envelope.hash,
    createdAt: envelope.createdAt,
    metadata: (envelope.metadata ?? {}) as Prisma.InputJsonValue,
    ...(envelope.tenantId ? { tenant: { connect: { id: envelope.tenantId } } } : {}),
    ...(envelope.actorType ? { actorType: envelope.actorType } : {}),
    ...(envelope.actorId ? { actorId: envelope.actorId } : {}),
    ...(envelope.resourceId ? { resourceId: envelope.resourceId } : {}),
    ...(envelope.policyDecision ? { policyDecision: envelope.policyDecision } : {}),
    ...(envelope.requestId ? { requestId: envelope.requestId } : {}),
    ...(envelope.ipAddress ? { ipAddress: envelope.ipAddress } : {}),
    ...(envelope.userAgent ? { userAgent: envelope.userAgent } : {})
  };

  await prisma.auditEvent.create({ data: auditData });

  return reply.code(201).send({ accepted: true, hash: envelope.hash });
});

app.post<{
  Body: {
    principal: AuthenticatedPrincipal;
    title: string;
    purpose?: string;
    memoryEnabled?: boolean;
    entityContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
}>("/v1/banana-chat/conversations", async (request, reply) => {
  if (!hasPermission(request.body.principal, "chat:use")) {
    return reply.code(403).send({ error: "chat_access_denied" });
  }
  const conversation = await prisma.conversation.create({
    data: {
      tenantId: request.body.principal.tenantId,
      ownerUserId: request.body.principal.principalId,
      title: request.body.title,
      ...(request.body.purpose ? { purpose: request.body.purpose } : {}),
      memoryEnabled: request.body.memoryEnabled ?? true,
      entityContext: (request.body.entityContext ?? {}) as Prisma.InputJsonValue,
      metadata: (request.body.metadata ?? {}) as Prisma.InputJsonValue
    }
  });
  await writePlatformAudit(
    request.body.principal,
    "conversation.created",
    "conversation",
    conversation.id,
    request.id
  );
  return reply.code(201).send({ conversation });
});

app.get<{
  Headers: { principal?: string };
}>("/v1/banana-chat/conversations", async (request, reply) => {
  const principal = parsePrincipalHeader(request.headers.principal);
  if (!principal || !hasPermission(principal, "chat:use")) {
    return reply.code(403).send({ error: "chat_access_denied" });
  }
  const conversations = await prisma.conversation.findMany({
    where: {
      tenantId: principal.tenantId,
      status: { not: "DELETED" },
      ...(hasPermission(principal, "chat:admin") ? {} : { ownerUserId: principal.principalId })
    },
    include: {
      _count: { select: { messages: true, attachments: true, reportArtifacts: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
  return { conversations };
});

app.get<{
  Params: { conversationId: string };
  Headers: { principal?: string };
}>("/v1/banana-chat/conversations/:conversationId", async (request, reply) => {
  const principal = parsePrincipalHeader(request.headers.principal);
  if (!principal || !hasPermission(principal, "chat:use")) {
    return reply.code(403).send({ error: "chat_access_denied" });
  }
  const conversation = await findAccessibleConversation(principal, request.params.conversationId);
  if (!conversation) {
    return reply.code(404).send({ error: "conversation_not_found" });
  }
  const fullConversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversation.id },
    include: {
      messages: {
        include: {
          citations: true,
          toolInvocations: true,
          reportArtifacts: true
        },
        orderBy: { createdAt: "asc" }
      },
      attachments: { include: { fileAsset: true } },
      reportArtifacts: { orderBy: { createdAt: "desc" } }
    }
  });
  return { conversation: fullConversation };
});

app.post<{
  Params: { conversationId: string };
  Body: {
    principal: AuthenticatedPrincipal;
    content: string;
    tools?: BananaToolRequest[];
  };
}>("/v1/banana-chat/conversations/:conversationId/messages", async (request, reply) => {
  try {
    const result = await bananaChat.sendMessage(
      request.body.principal,
      request.params.conversationId,
      {
        content: request.body.content,
        ...(request.body.tools ? { tools: request.body.tools } : {})
      }
    );
    await writePlatformAudit(
      request.body.principal,
      "banana_chat.response.generated",
      "conversation",
      request.params.conversationId,
      request.id
    );
    return reply.code(201).send(result);
  } catch (error) {
    return reply.code(400).send({
      error: "banana_chat_failed",
      detail: error instanceof Error ? error.message : "unknown_error"
    });
  }
});

app.post<{
  Params: { conversationId: string };
  Body: {
    principal: AuthenticatedPrincipal;
    consentGrantId?: string;
    files: UploadSessionFile[];
    consentState?: "REQUESTED" | "GRANTED" | "DENIED" | "REVOKED" | "EXPIRED" | "SUSPENDED";
  };
}>("/v1/banana-chat/conversations/:conversationId/file-upload-sessions", async (request, reply) => {
  const conversation = await findAccessibleConversation(
    request.body.principal,
    request.params.conversationId
  );
  if (!conversation) {
    return reply.code(404).send({ error: "conversation_not_found" });
  }
  const decision = enforceFoundationAccess(request.body.principal, {
    resource: "file_asset",
    action: "create",
    ...(request.body.consentState ? { consentState: request.body.consentState } : {})
  });
  if (!decision.allowed) {
    return reply.code(403).send(decision);
  }
  const files = [];
  for (const file of request.body.files) {
    const prepared = await createUploadSessionFile(request.body.principal, file, {
      ...(request.body.consentGrantId ? { consentGrantId: request.body.consentGrantId } : {}),
      visibilityScope: "tenant"
    });
    const fileAsset = prepared.fileAsset as { id: string };
    await prisma.chatFileAttachment.create({
      data: {
        conversationId: conversation.id,
        fileAssetId: fileAsset.id,
        attachedBy: request.body.principal.principalId,
        purpose: "banana_chat_analysis"
      }
    });
    files.push(prepared);
  }
  return reply.code(201).send({
    uploadMode: "direct-presigned-put",
    expiresInSeconds: config.INGESTION_UPLOAD_URL_TTL_SECONDS,
    files
  });
});

app.post<{
  Params: { conversationId: string };
  Body: { principal: AuthenticatedPrincipal; fileAssetIds: string[] };
}>("/v1/banana-chat/conversations/:conversationId/attachments", async (request, reply) => {
  const conversation = await findAccessibleConversation(
    request.body.principal,
    request.params.conversationId
  );
  if (!conversation) {
    return reply.code(404).send({ error: "conversation_not_found" });
  }
  const files = await prisma.fileAsset.findMany({
    where: {
      id: { in: request.body.fileAssetIds },
      tenantId: request.body.principal.tenantId
    },
    select: { id: true }
  });
  await prisma.chatFileAttachment.createMany({
    data: files.map((file) => ({
      conversationId: conversation.id,
      fileAssetId: file.id,
      attachedBy: request.body.principal.principalId,
      purpose: "banana_chat_analysis"
    })),
    skipDuplicates: true
  });
  return reply.code(201).send({ attachedFileIds: files.map((file) => file.id) });
});

app.post<{
  Body: CreateMemoryInput & { principal: AuthenticatedPrincipal };
}>("/v1/banana-chat/memories", async (request, reply) => {
  const { principal, ...input } = request.body;
  try {
    const memory = await createMemory(prisma, principal, input);
    await writePlatformAudit(principal, "memory.created", "memory", memory.id, request.id);
    return reply.code(201).send({ memory });
  } catch (error) {
    return reply.code(403).send({
      error: "memory_creation_denied",
      detail: error instanceof Error ? error.message : "unknown_error"
    });
  }
});

app.get<{
  Querystring: { query?: string; conversationId?: string; entityType?: string; entityId?: string };
  Headers: { principal?: string };
}>("/v1/banana-chat/memories", async (request, reply) => {
  const principal = parsePrincipalHeader(request.headers.principal);
  if (!principal || !hasPermission(principal, "memory:read")) {
    return reply.code(403).send({ error: "memory_read_denied" });
  }
  const memories = await retrieveMemories(prisma, principal, {
    query: request.query.query ?? "",
    ...(request.query.conversationId ? { conversationId: request.query.conversationId } : {}),
    ...(request.query.entityType ? { entityType: request.query.entityType } : {}),
    ...(request.query.entityId ? { entityId: request.query.entityId } : {}),
    take: 100
  });
  return { memories };
});

app.delete<{
  Params: { memoryId: string };
  Body: { principal: AuthenticatedPrincipal };
}>("/v1/banana-chat/memories/:memoryId", async (request, reply) => {
  if (!hasPermission(request.body.principal, "memory:delete")) {
    return reply.code(403).send({ error: "memory_delete_denied" });
  }
  await deleteMemory(prisma, request.body.principal, request.params.memoryId);
  await writePlatformAudit(
    request.body.principal,
    "memory.deleted",
    "memory",
    request.params.memoryId,
    request.id
  );
  return reply.code(204).send();
});

app.get<{
  Querystring: { conversationId?: string };
  Headers: { principal?: string };
}>("/v1/banana-chat/reports", async (request, reply) => {
  const principal = parsePrincipalHeader(request.headers.principal);
  if (!principal || !hasPermission(principal, "report:read")) {
    return reply.code(403).send({ error: "report_read_denied" });
  }
  const reports = await prisma.reportArtifact.findMany({
    where: {
      tenantId: principal.tenantId,
      ...(request.query.conversationId ? { conversationId: request.query.conversationId } : {}),
      ...(hasPermission(principal, "chat:admin") ? {} : { requestedBy: principal.principalId })
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return { reports };
});

app.post<{
  Body: CreateInsightInput & {
    principal: AuthenticatedPrincipal;
  };
}>("/v1/insights", async (request, reply) => {
  const { principal, ...body } = request.body;
  if (!canManageInsights(principal)) {
    return reply.code(403).send({ error: "insight_create_denied" });
  }
  if (body.scope !== "TENANT" && !isBiMasterPrincipal(principal)) {
    return reply.code(403).send({ error: "shared_insight_create_denied" });
  }

  try {
    const insight = await createInsight(prisma, {
      ...body,
      ...(body.scope === "TENANT" ? { tenantId: principal.tenantId } : {}),
      createdBy: principal.principalId
    });
    await writePlatformAudit(principal, "insight.created", "insight", insight.id, request.id);
    return reply.code(201).send({ insight });
  } catch (error) {
    return reply.code(400).send({
      error: "insight_create_failed",
      detail: error instanceof Error ? error.message : "unknown_error"
    });
  }
});

app.post<{
  Params: { insightId: string };
  Body: {
    principal: AuthenticatedPrincipal;
    title: string;
    summary: string;
    structuredClaims?: unknown[];
    recommendations?: unknown[];
    content?: Record<string, unknown>;
  };
}>("/v1/insights/:insightId/versions", async (request, reply) => {
  if (!canManageInsights(request.body.principal)) {
    return reply.code(403).send({ error: "insight_version_denied" });
  }
  if (!(await canManageInsightArtifact(request.body.principal, request.params.insightId))) {
    return reply.code(403).send({ error: "insight_version_scope_denied" });
  }
  const version = await createInsightVersion(prisma, {
    insightId: request.params.insightId,
    title: request.body.title,
    summary: request.body.summary,
    ...(request.body.structuredClaims ? { structuredClaims: request.body.structuredClaims } : {}),
    ...(request.body.recommendations ? { recommendations: request.body.recommendations } : {}),
    ...(request.body.content ? { content: request.body.content } : {}),
    createdBy: request.body.principal.principalId
  });
  await writePlatformAudit(
    request.body.principal,
    "insight.version.created",
    "insight",
    request.params.insightId,
    request.id
  );
  return reply.code(201).send({ version });
});

app.get<{
  Querystring: {
    artifactType?: CreateInsightInput["artifactType"];
    status?: string;
    riskLevel?: string;
    subjectType?: string;
    subjectId?: string;
    take?: string;
  };
  Headers: { principal?: string };
}>("/v1/insights", async (request, reply) => {
  const principal = parsePrincipalHeader(request.headers.principal);
  if (!principal || !hasPermission(principal, "insight:read")) {
    return reply.code(403).send({ error: "insight_read_denied" });
  }
  const insights = await prisma.insightArtifact.findMany({
    where: {
      AND: [
        insightVisibilityWhere(principal),
        {
          ...(request.query.artifactType ? { artifactType: request.query.artifactType } : {}),
          ...(request.query.status ? { status: request.query.status as never } : {}),
          ...(request.query.riskLevel ? { riskLevel: request.query.riskLevel as never } : {}),
          ...(request.query.subjectType || request.query.subjectId
            ? {
                subjects: {
                  some: {
                    ...(request.query.subjectType ? { entityType: request.query.subjectType } : {}),
                    ...(request.query.subjectId ? { entityId: request.query.subjectId } : {})
                  }
                }
              }
            : {})
        }
      ]
    },
    include: {
      subjects: true,
      evidence: true
    },
    orderBy: { updatedAt: "desc" },
    take: Math.min(Number(request.query.take ?? 50), 200)
  });
  return { insights };
});

app.get<{
  Params: { insightId: string };
  Headers: { principal?: string };
}>("/v1/insights/:insightId", async (request, reply) => {
  const principal = parsePrincipalHeader(request.headers.principal);
  if (!principal || !hasPermission(principal, "insight:read")) {
    return reply.code(403).send({ error: "insight_read_denied" });
  }
  const insight = await prisma.insightArtifact.findFirst({
    where: {
      id: request.params.insightId,
      AND: [insightVisibilityWhere(principal)]
    },
    include: {
      versions: { orderBy: { version: "desc" } },
      evidence: true,
      subjects: true,
      reviews: { orderBy: { createdAt: "desc" } }
    }
  });
  return insight ? { insight } : reply.code(404).send({ error: "insight_not_found" });
});

app.post<{
  Params: { insightId: string };
  Body: {
    principal: AuthenticatedPrincipal;
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "RECALLED";
    notes?: string;
    checklist?: Record<string, unknown>;
  };
}>("/v1/insights/:insightId/reviews", async (request, reply) => {
  if (!canReviewInsights(request.body.principal)) {
    return reply.code(403).send({ error: "insight_review_denied" });
  }
  if (!(await canManageInsightArtifact(request.body.principal, request.params.insightId))) {
    return reply.code(403).send({ error: "insight_review_scope_denied" });
  }
  await reviewInsight(prisma, {
    insightId: request.params.insightId,
    decision: request.body.decision,
    reviewerId: request.body.principal.principalId,
    ...(request.body.notes ? { notes: request.body.notes } : {}),
    ...(request.body.checklist ? { checklist: request.body.checklist } : {})
  });
  await writePlatformAudit(
    request.body.principal,
    "insight.reviewed",
    "insight",
    request.params.insightId,
    request.id
  );
  return reply.code(201).send({ accepted: true });
});

app.post<{
  Params: { insightId: string };
  Body: { principal: AuthenticatedPrincipal };
}>("/v1/insights/:insightId/publish", async (request, reply) => {
  if (!hasPermission(request.body.principal, "insight:publish")) {
    return reply.code(403).send({ error: "insight_publish_denied" });
  }
  if (!(await canManageInsightArtifact(request.body.principal, request.params.insightId))) {
    return reply.code(403).send({ error: "insight_publish_scope_denied" });
  }
  try {
    await publishInsight(prisma, request.params.insightId);
    await projectPublishedInsight(prisma, request.params.insightId);
    await writePlatformAudit(
      request.body.principal,
      "insight.published",
      "insight",
      request.params.insightId,
      request.id
    );
    return { published: true };
  } catch (error) {
    return reply.code(409).send({
      error: "insight_publication_blocked",
      detail: error instanceof Error ? error.message : "unknown_error"
    });
  }
});

app.post<{ Body: GraphNodeInput & { principal: AuthenticatedPrincipal } }>(
  "/v1/knowledge-graph/nodes",
  async (request, reply) => {
    const { principal, ...body } = request.body;
    if (!hasPermission(principal, "graph:write")) {
      return reply.code(403).send({ error: "graph_write_denied" });
    }
    if (body.partition !== "TENANT" && !isBiMasterPrincipal(principal)) {
      return reply.code(403).send({ error: "shared_graph_write_denied" });
    }
    try {
      const node = await upsertGraphNode(prisma, {
        ...body,
        ...(body.partition === "TENANT" ? { tenantId: principal.tenantId } : {})
      });
      await writePlatformAudit(principal, "graph.node.upserted", "graph_node", node.id, request.id);
      return reply.code(201).send({ node });
    } catch (error) {
      return reply.code(400).send({
        error: "graph_node_write_failed",
        detail: error instanceof Error ? error.message : "unknown_error"
      });
    }
  }
);

app.post<{ Body: GraphEdgeInput & { principal: AuthenticatedPrincipal } }>(
  "/v1/knowledge-graph/edges",
  async (request, reply) => {
    const { principal, ...body } = request.body;
    if (!hasPermission(principal, "graph:write")) {
      return reply.code(403).send({ error: "graph_write_denied" });
    }
    if (body.partition !== "TENANT" && !isBiMasterPrincipal(principal)) {
      return reply.code(403).send({ error: "shared_graph_write_denied" });
    }
    try {
      const edge = await upsertGraphEdge(prisma, {
        ...body,
        ...(body.partition === "TENANT" ? { tenantId: principal.tenantId } : {})
      });
      await writePlatformAudit(principal, "graph.edge.upserted", "graph_edge", edge.id, request.id);
      return reply.code(201).send({ edge });
    } catch (error) {
      return reply.code(400).send({
        error: "graph_edge_write_failed",
        detail: error instanceof Error ? error.message : "unknown_error"
      });
    }
  }
);

app.get<{
  Params: { nodeId: string };
  Querystring: { depth?: string };
  Headers: { principal?: string };
}>("/v1/knowledge-graph/nodes/:nodeId/neighborhood", async (request, reply) => {
  const principal = parsePrincipalHeader(request.headers.principal);
  if (!principal || !hasPermission(principal, "graph:read")) {
    return reply.code(403).send({ error: "graph_read_denied" });
  }
  const neighborhood = await getGraphNeighborhood(
    prisma,
    request.params.nodeId,
    graphVisibilityWhere(principal),
    Number(request.query.depth ?? 1)
  );
  return { neighborhood };
});

app.post<{
  Body: {
    principal: AuthenticatedPrincipal;
    partition: "TENANT" | "SHARED_CONCEPT" | "INSIGHTS" | "NETWORK_PROJECTION" | "INTERNAL";
    proposalType: string;
    payload: Record<string, unknown>;
    confidenceScore: number;
    modelId?: string;
    promptVersion?: string;
  };
}>("/v1/knowledge-graph/proposals", async (request, reply) => {
  if (!hasPermission(request.body.principal, "graph:write")) {
    return reply.code(403).send({ error: "graph_proposal_denied" });
  }
  if (request.body.partition !== "TENANT" && !isBiMasterPrincipal(request.body.principal)) {
    return reply.code(403).send({ error: "shared_graph_proposal_denied" });
  }
  const proposal = await prisma.graphChangeProposal.create({
    data: {
      ...(request.body.partition === "TENANT" ? { tenantId: request.body.principal.tenantId } : {}),
      partition: request.body.partition,
      proposalType: request.body.proposalType,
      payload: request.body.payload as Prisma.InputJsonValue,
      confidenceScore: decimal(request.body.confidenceScore),
      proposedBy: request.body.principal.principalId,
      ...(request.body.modelId ? { modelId: request.body.modelId } : {}),
      ...(request.body.promptVersion ? { promptVersion: request.body.promptVersion } : {})
    }
  });
  return reply.code(201).send({ proposal });
});

app.post<{
  Params: { proposalId: string };
  Body: {
    principal: AuthenticatedPrincipal;
    decision: "APPROVED" | "REJECTED";
    reviewNotes?: string;
  };
}>("/v1/knowledge-graph/proposals/:proposalId/review", async (request, reply) => {
  if (!hasPermission(request.body.principal, "graph:review")) {
    return reply.code(403).send({ error: "graph_review_denied" });
  }
  const existingProposal = await prisma.graphChangeProposal.findUniqueOrThrow({
    where: { id: request.params.proposalId }
  });
  if (
    existingProposal.tenantId !== request.body.principal.tenantId &&
    !isBiMasterPrincipal(request.body.principal)
  ) {
    return reply.code(403).send({ error: "graph_review_scope_denied" });
  }
  const proposal = await prisma.graphChangeProposal.update({
    where: { id: request.params.proposalId },
    data: {
      decision: request.body.decision,
      reviewedBy: request.body.principal.principalId,
      reviewedAt: new Date(),
      ...(request.body.reviewNotes ? { reviewNotes: request.body.reviewNotes } : {})
    }
  });
  await writePlatformAudit(
    request.body.principal,
    "graph.proposal.reviewed",
    "graph_change_proposal",
    proposal.id,
    request.id
  );
  return { proposal };
});

app.post<{
  Body: {
    principal: AuthenticatedPrincipal;
    name: string;
    description?: string;
    consentGrantId?: string;
    visibilityScope?: string;
    metadata?: Record<string, unknown>;
    consentState?: "REQUESTED" | "GRANTED" | "DENIED" | "REVOKED" | "EXPIRED" | "SUSPENDED";
  };
}>("/v1/ingestion/datasets", async (request, reply) => {
  const decision = enforceFoundationAccess(request.body.principal, {
    resource: "dataset",
    action: "create",
    ...(request.body.consentState ? { consentState: request.body.consentState } : {})
  });

  if (!decision.allowed) {
    return reply.code(403).send(decision);
  }

  const dataset = await prisma.dataset.create({
    data: {
      tenantId: request.body.principal.tenantId,
      name: request.body.name,
      ...(request.body.description ? { description: request.body.description } : {}),
      ...(request.body.consentGrantId ? { consentGrantId: request.body.consentGrantId } : {}),
      ownerType: "CLIENT",
      visibilityScope: request.body.visibilityScope ?? "tenant",
      metadata: (request.body.metadata ?? {}) as Prisma.InputJsonValue,
      createdBy: request.body.principal.principalId
    }
  });

  await prisma.lineageEvent.create({
    data: {
      tenantId: request.body.principal.tenantId,
      datasetId: dataset.id,
      eventType: "DATASET_CREATED",
      createdBy: request.body.principal.principalId,
      metadata: {
        requestId: request.id
      }
    }
  });

  return reply.code(201).send({ dataset });
});

app.post<{
  Body: {
    principal: AuthenticatedPrincipal;
    datasetId?: string;
    consentGrantId?: string;
    visibilityScope?: string;
    files: UploadSessionFile[];
    consentState?: "REQUESTED" | "GRANTED" | "DENIED" | "REVOKED" | "EXPIRED" | "SUSPENDED";
  };
}>("/v1/ingestion/upload-sessions", async (request, reply) => {
  const decision = enforceFoundationAccess(request.body.principal, {
    resource: "file_asset",
    action: "create",
    ...(request.body.consentState ? { consentState: request.body.consentState } : {})
  });

  if (!decision.allowed) {
    return reply.code(403).send(decision);
  }

  const files = await Promise.all(
    request.body.files.map(async (file) =>
      createUploadSessionFile(request.body.principal, file, {
        ...(request.body.datasetId ? { datasetId: request.body.datasetId } : {}),
        ...(request.body.consentGrantId ? { consentGrantId: request.body.consentGrantId } : {}),
        visibilityScope: request.body.visibilityScope ?? "tenant"
      })
    )
  );

  return reply.code(201).send({
    uploadMode: "direct-presigned-put",
    expiresInSeconds: config.INGESTION_UPLOAD_URL_TTL_SECONDS,
    files
  });
});

app.post<{
  Params: {
    fileAssetId: string;
  };
  Body: {
    principal: AuthenticatedPrincipal;
    bucket?: string;
    objectKey: string;
    contentType?: string;
    byteSize?: number;
    checksum?: string;
    consentState?: "REQUESTED" | "GRANTED" | "DENIED" | "REVOKED" | "EXPIRED" | "SUSPENDED";
  };
}>("/v1/ingestion/file-assets/:fileAssetId/complete", async (request, reply) => {
  const fileAsset = await prisma.fileAsset.findFirst({
    where: {
      id: request.params.fileAssetId,
      tenantId: request.body.principal.tenantId
    }
  });

  if (!fileAsset) {
    return reply.code(404).send({ error: "file_asset_not_found" });
  }

  const decision = enforceFoundationAccess(request.body.principal, {
    resource: "file_asset",
    action: "update",
    ...(request.body.consentState ? { consentState: request.body.consentState } : {})
  });

  if (!decision.allowed) {
    return reply.code(403).send(decision);
  }

  const objectRecord = await prisma.objectRecord.create({
    data: {
      tenantId: fileAsset.tenantId,
      bucket: request.body.bucket ?? config.OBJECT_STORAGE_BUCKET,
      objectKey: request.body.objectKey,
      ...(request.body.contentType ? { contentType: request.body.contentType } : {}),
      ...(request.body.byteSize ? { byteSize: BigInt(request.body.byteSize) } : {}),
      ...(request.body.checksum ? { checksum: request.body.checksum } : {}),
      ownerType: "CLIENT",
      dataClass: "RAW",
      visibilityScope: fileAsset.visibilityScope,
      ...(fileAsset.consentGrantId ? { consentGrantId: fileAsset.consentGrantId } : {}),
      metadata: {
        fileAssetId: fileAsset.id,
        uploadedBy: request.body.principal.principalId
      }
    }
  });

  const updated = await prisma.fileAsset.update({
    where: { id: fileAsset.id },
    data: {
      objectRecordId: objectRecord.id,
      status: "UPLOADED",
      ...(request.body.contentType ? { contentType: request.body.contentType } : {}),
      ...(request.body.byteSize ? { byteSize: BigInt(request.body.byteSize) } : {}),
      ...(request.body.checksum ? { checksum: request.body.checksum } : {})
    }
  });

  await prisma.fileAssetVersion.create({
    data: {
      fileAssetId: fileAsset.id,
      objectRecordId: objectRecord.id,
      version: fileAsset.version,
      ...(request.body.byteSize ? { byteSize: BigInt(request.body.byteSize) } : {}),
      ...(request.body.checksum ? { checksum: request.body.checksum } : {}),
      createdBy: request.body.principal.principalId,
      metadata: {
        objectKey: request.body.objectKey
      }
    }
  });

  await prisma.lineageEvent.createMany({
    data: [
      {
        tenantId: fileAsset.tenantId,
        fileAssetId: fileAsset.id,
        datasetId: fileAsset.datasetId,
        eventType: "UPLOADED",
        sourceRef: { objectKey: request.body.objectKey },
        targetRef: { fileAssetId: fileAsset.id },
        createdBy: request.body.principal.principalId,
        metadata: { requestId: request.id }
      },
      {
        tenantId: fileAsset.tenantId,
        fileAssetId: fileAsset.id,
        datasetId: fileAsset.datasetId,
        eventType: "VERSION_CREATED",
        sourceRef: { objectRecordId: objectRecord.id },
        targetRef: { version: fileAsset.version },
        createdBy: request.body.principal.principalId
      }
    ]
  });

  const jobs = await createProcessingJobs(
    updated.id,
    updated.tenantId,
    updated.datasetId,
    updated.kind,
    {
      objectKey: request.body.objectKey
    }
  );

  return reply.code(202).send({
    fileAsset: updated,
    objectRecord,
    jobs
  });
});

app.get<{
  Params: {
    fileAssetId: string;
  };
  Headers: {
    principal?: string;
  };
}>("/v1/ingestion/file-assets/:fileAssetId", async (request, reply) => {
  const principal = parsePrincipalHeader(request.headers.principal);
  if (!principal || !hasPermission(principal, "file_asset:read")) {
    return reply.code(403).send({ error: "file_asset_read_denied" });
  }
  const fileAsset = await prisma.fileAsset.findFirst({
    where: { id: request.params.fileAssetId, tenantId: principal.tenantId },
    include: {
      versions: true,
      processingJobs: true,
      validationIssues: true,
      lineageEvents: true
    }
  });

  if (!fileAsset) {
    return reply.code(404).send({ error: "file_asset_not_found" });
  }

  return { fileAsset };
});

app.post<{
  Body: {
    principal: AuthenticatedPrincipal;
    tenantId: string;
    name: string;
    planKey?: string;
    currency?: string;
    monthlyIncludedCredits?: number;
    fixedMonthlyPlatformFee?: number;
    hardCapAmount?: number;
    softCapAmount?: number;
    partnerPricing?: boolean;
    demoUsageBillable?: boolean;
    metadata?: Record<string, unknown>;
  };
}>("/v1/bi/admin/billing/policies", async (request, reply) => {
  try {
    requireInternalCostAccess(request.body.principal);
  } catch {
    return reply.code(403).send({ error: "internal_billing_access_denied" });
  }

  const policy = await prisma.clientBillingPolicy.create({
    data: {
      tenantId: request.body.tenantId,
      name: request.body.name,
      status: "ACTIVE",
      ...(request.body.planKey ? { planKey: request.body.planKey } : {}),
      currency: request.body.currency ?? "USD",
      monthlyIncludedCredits: decimal(request.body.monthlyIncludedCredits ?? 0),
      fixedMonthlyPlatformFee: decimal(request.body.fixedMonthlyPlatformFee ?? 0),
      ...(request.body.hardCapAmount !== undefined
        ? { hardCapAmount: decimal(request.body.hardCapAmount) }
        : {}),
      ...(request.body.softCapAmount !== undefined
        ? { softCapAmount: decimal(request.body.softCapAmount) }
        : {}),
      partnerPricing: request.body.partnerPricing ?? false,
      demoUsageBillable: request.body.demoUsageBillable ?? false,
      metadata: (request.body.metadata ?? {}) as Prisma.InputJsonValue,
      createdBy: request.body.principal.principalId
    }
  });

  await writeBillingAudit(
    request.body.principal,
    "billing_policy.changed",
    "client_billing_policy",
    policy.id,
    request.id
  );
  return reply.code(201).send({ policy });
});

app.post<{
  Params: { policyId: string };
  Body: {
    principal: AuthenticatedPrincipal;
    ruleType:
      | "ORGANIZATION"
      | "PLAN"
      | "FEATURE"
      | "MODEL_PROVIDER"
      | "TOKEN_TYPE"
      | "FILE_PROCESSING_TYPE"
      | "REPORT_TYPE"
      | "INGESTION_TYPE"
      | "FIXED_MONTHLY_PLATFORM_FEE"
      | "USAGE_TIER"
      | "OVERAGE_RULE"
      | "ENTERPRISE_CUSTOM"
      | "PARTNER_PRICING";
    method: "PERCENTAGE" | "MULTIPLIER" | "FIXED_UNIT_PRICE" | "FIXED_AMOUNT";
    value: number;
    priority?: number;
    featureKey?: string;
    providerKey?: string;
    modelKey?: string;
    tokenType?: string;
    processingType?: string;
    reportType?: string;
    ingestionType?: string;
    tierFrom?: number;
    tierTo?: number;
    overage?: boolean;
    metadata?: Record<string, unknown>;
  };
}>("/v1/bi/admin/billing/policies/:policyId/markup-rules", async (request, reply) => {
  try {
    requireInternalCostAccess(request.body.principal);
  } catch {
    return reply.code(403).send({ error: "markup_access_denied" });
  }

  const rule = await prisma.clientMarkupRule.create({
    data: {
      billingPolicyId: request.params.policyId,
      ruleType: request.body.ruleType,
      method: request.body.method,
      value: decimal(request.body.value),
      priority: request.body.priority ?? 100,
      ...(request.body.featureKey ? { featureKey: request.body.featureKey } : {}),
      ...(request.body.providerKey ? { providerKey: request.body.providerKey } : {}),
      ...(request.body.modelKey ? { modelKey: request.body.modelKey } : {}),
      ...(request.body.tokenType ? { tokenType: request.body.tokenType } : {}),
      ...(request.body.processingType ? { processingType: request.body.processingType } : {}),
      ...(request.body.reportType ? { reportType: request.body.reportType } : {}),
      ...(request.body.ingestionType ? { ingestionType: request.body.ingestionType } : {}),
      ...(request.body.tierFrom !== undefined ? { tierFrom: decimal(request.body.tierFrom) } : {}),
      ...(request.body.tierTo !== undefined ? { tierTo: decimal(request.body.tierTo) } : {}),
      overage: request.body.overage ?? false,
      metadata: (request.body.metadata ?? {}) as Prisma.InputJsonValue
    }
  });

  await writeBillingAudit(
    request.body.principal,
    "markup_rule.changed",
    "client_markup_rule",
    rule.id,
    request.id
  );
  return reply.code(201).send({ rule });
});

app.post<{
  Body: {
    principal: AuthenticatedPrincipal;
    tenantId: string;
    billingPolicyId?: string;
    name: string;
    capMode?: "NONE" | "SOFT" | "HARD";
    budgetAmount: number;
    alertThresholds?: unknown[];
    appliesTo?: Record<string, unknown>;
  };
}>("/v1/bi/admin/billing/budget-policies", async (request, reply) => {
  try {
    requireInternalUsageAccess(request.body.principal);
  } catch {
    return reply.code(403).send({ error: "budget_access_denied" });
  }

  const budget = await prisma.budgetPolicy.create({
    data: {
      tenantId: request.body.tenantId,
      ...(request.body.billingPolicyId ? { billingPolicyId: request.body.billingPolicyId } : {}),
      name: request.body.name,
      capMode: request.body.capMode ?? "SOFT",
      budgetAmount: decimal(request.body.budgetAmount),
      alertThresholds: (request.body.alertThresholds ?? []) as Prisma.InputJsonValue,
      appliesTo: (request.body.appliesTo ?? {}) as Prisma.InputJsonValue
    }
  });

  await writeBillingAudit(
    request.body.principal,
    "budget_policy.changed",
    "budget_policy",
    budget.id,
    request.id
  );
  return reply.code(201).send({ budget });
});

app.get<{
  Querystring: {
    tenantId: string;
    periodStart: string;
    periodEnd: string;
    userId?: string;
  };
  Headers: {
    principal?: string;
  };
}>("/v1/client/usage/summary", async (request, reply) => {
  const principal = parsePrincipalHeader(request.headers.principal);
  if (!principal) {
    return reply.code(401).send({ error: "principal_required" });
  }

  const clientUserUsageEnabled = await isClientUserUsageEnabled(request.query.tenantId);
  const requestedUserId = request.query.userId;
  const summaryUserId = canViewClientTenantUsage(principal, request.query.tenantId)
    ? requestedUserId
    : principal.principalId;

  if (requestedUserId && requestedUserId !== principal.principalId) {
    try {
      requireClientBillableAccess(principal, request.query.tenantId);
    } catch {
      return reply.code(403).send({ error: "client_usage_access_denied" });
    }
  } else if (!canViewClientTenantUsage(principal, request.query.tenantId)) {
    if (
      !canViewOwnUsage(
        principal,
        request.query.tenantId,
        principal.principalId,
        clientUserUsageEnabled
      )
    ) {
      return reply.code(403).send({ error: "client_usage_access_denied" });
    }
  }

  const summary = await buildClientUsageSummary(prisma, {
    tenantId: request.query.tenantId,
    ...(summaryUserId ? { userId: summaryUserId } : {}),
    periodStart: new Date(request.query.periodStart),
    periodEnd: new Date(request.query.periodEnd)
  });

  return { summary };
});

app.get<{
  Querystring: {
    tenantId?: string;
    periodStart: string;
    periodEnd: string;
  };
  Headers: {
    principal?: string;
  };
}>("/v1/bi/admin/usage/margin-report", async (request, reply) => {
  const principal = parsePrincipalHeader(request.headers.principal);
  if (!principal) {
    return reply.code(401).send({ error: "principal_required" });
  }

  try {
    requireInternalCostAccess(principal);
  } catch {
    return reply.code(403).send({ error: "internal_margin_access_denied" });
  }

  const report = await buildMasterMarginReport(prisma, {
    ...(request.query.tenantId ? { tenantId: request.query.tenantId } : {}),
    periodStart: new Date(request.query.periodStart),
    periodEnd: new Date(request.query.periodEnd)
  });

  return { report };
});

app.post<{
  Body: {
    principal: AuthenticatedPrincipal;
    tenantId?: string;
    audience: "CLIENT" | "INTERNAL";
    periodStart: string;
    periodEnd: string;
    format: string;
    filters?: Record<string, unknown>;
  };
}>("/v1/usage/exports", async (request, reply) => {
  if (request.body.audience === "INTERNAL") {
    try {
      requireInternalCostAccess(request.body.principal);
    } catch {
      return reply.code(403).send({ error: "internal_export_access_denied" });
    }
  } else if (!request.body.tenantId) {
    return reply.code(400).send({ error: "tenant_required_for_client_export" });
  } else {
    try {
      requireClientBillableAccess(request.body.principal, request.body.tenantId);
    } catch {
      return reply.code(403).send({ error: "client_export_access_denied" });
    }
  }

  const usageExport = await prisma.usageExport.create({
    data: {
      ...(request.body.tenantId ? { tenantId: request.body.tenantId } : {}),
      audience: request.body.audience,
      requestedBy: request.body.principal.principalId,
      periodStart: new Date(request.body.periodStart),
      periodEnd: new Date(request.body.periodEnd),
      format: request.body.format,
      filters: (request.body.filters ?? {}) as Prisma.InputJsonValue
    }
  });

  await writeBillingAudit(
    request.body.principal,
    request.body.audience === "INTERNAL" ? "internal_cost.exported" : "client_usage.exported",
    "usage_export",
    usageExport.id,
    request.id
  );

  return reply.code(201).send({ usageExport });
});

app.post<{
  Body: {
    principal: AuthenticatedPrincipal;
    tenantId: string;
    amount: number;
    description: string;
    entryType: "CREDIT" | "REFUND" | "ADJUSTMENT" | "COMPED" | "DEMO";
    sourceFeature?: string;
    relatedType?: string;
    relatedId?: string;
  };
}>("/v1/bi/admin/billing/manual-adjustments", async (request, reply) => {
  try {
    requireInternalCostAccess(request.body.principal);
  } catch {
    return reply.code(403).send({ error: "manual_adjustment_access_denied" });
  }

  const usageEvent = await prisma.usageEvent.create({
    data: {
      tenantId: request.body.tenantId,
      eventType: "MANUAL_ADJUSTMENT",
      sourceFeature: request.body.sourceFeature ?? "manual_billing_adjustment",
      billable: request.body.entryType !== "COMPED" && request.body.entryType !== "DEMO",
      internalComped: request.body.entryType === "COMPED",
      demoUsage: request.body.entryType === "DEMO",
      ...(request.body.relatedType ? { relatedType: request.body.relatedType } : {}),
      ...(request.body.relatedId ? { relatedId: request.body.relatedId } : {}),
      metadata: { description: request.body.description }
    }
  });

  const ledger = await prisma.clientBillableLedger.create({
    data: {
      tenantId: request.body.tenantId,
      usageEventId: usageEvent.id,
      billableUnits: decimal(1),
      clientUnitPrice: decimal(request.body.amount),
      clientFacingCost: decimal(request.body.amount),
      entryType: request.body.entryType,
      sourceFeature: request.body.sourceFeature ?? "manual_billing_adjustment",
      ...(request.body.relatedType ? { relatedType: request.body.relatedType } : {}),
      ...(request.body.relatedId ? { relatedId: request.body.relatedId } : {}),
      metadata: { description: request.body.description }
    }
  });

  await writeBillingAudit(
    request.body.principal,
    "manual_billing.adjusted",
    "client_billable_ledger",
    ledger.id,
    request.id
  );
  return reply.code(201).send({ usageEvent, ledger });
});

async function checkDatabase(): Promise<{ ok: boolean; detail?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "unknown database error" };
  }
}

async function checkRedis(): Promise<{ ok: boolean; detail?: string }> {
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    await redis.ping();
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "unknown cache error" };
  }
}

function enforceFoundationAccess(
  principal: AuthenticatedPrincipal,
  input: {
    resource: string;
    action: string;
    consentState?: "REQUESTED" | "GRANTED" | "DENIED" | "REVOKED" | "EXPIRED" | "SUSPENDED";
  }
): {
  allowed: boolean;
  rbacDecision: ReturnType<typeof can>;
  governanceDecision: ReturnType<typeof decidePolicy>;
} {
  const rbacDecision = can({
    principalPermissions: principal.permissions,
    required: {
      resource: input.resource,
      action: input.action
    }
  });

  const governanceDecision = decidePolicy(
    {
      tenantId: principal.tenantId,
      resource: input.resource,
      action: input.action,
      ...(input.consentState ? { consentState: input.consentState } : {})
    },
    [
      {
        key: "ingestion-foundation-policy",
        version: 1,
        status: "ACTIVE",
        effect: rbacDecision.allowed ? "ALLOW" : "DENY",
        resource: input.resource,
        action: input.action
      }
    ]
  );

  return {
    allowed: rbacDecision.allowed && governanceDecision.allowed,
    rbacDecision,
    governanceDecision
  };
}

async function createUploadSessionFile(
  principal: AuthenticatedPrincipal,
  file: UploadSessionFile,
  options: {
    datasetId?: string;
    consentGrantId?: string;
    visibilityScope: string;
  }
): Promise<Record<string, unknown>> {
  const findings = validateFileDescriptor(file);
  const kind = classifyFileKind(file);
  const status = findings.some((finding) => finding.severity === "ERROR")
    ? "REJECTED"
    : "PENDING_UPLOAD";

  const fileAsset = await prisma.fileAsset.create({
    data: {
      tenantId: principal.tenantId,
      ...(options.datasetId ? { datasetId: options.datasetId } : {}),
      ...(options.consentGrantId ? { consentGrantId: options.consentGrantId } : {}),
      filename: file.filename,
      ...(file.contentType ? { contentType: file.contentType } : {}),
      ...(file.byteSize ? { byteSize: BigInt(file.byteSize) } : {}),
      ...(file.checksum ? { checksum: file.checksum } : {}),
      kind,
      status,
      ownerType: "CLIENT",
      dataClass: "RAW",
      visibilityScope: options.visibilityScope,
      ...(file.sourceLabel ? { sourceLabel: file.sourceLabel } : {}),
      metadata: extractBaseMetadata(file) as Prisma.InputJsonValue,
      validationSummary: summarizeValidation(findings) as Prisma.InputJsonValue,
      createdBy: principal.principalId
    }
  });

  if (findings.length > 0) {
    await createValidationIssues(principal.tenantId, fileAsset.id, options.datasetId, findings);
  }

  await prisma.lineageEvent.create({
    data: {
      tenantId: principal.tenantId,
      fileAssetId: fileAsset.id,
      ...(options.datasetId ? { datasetId: options.datasetId } : {}),
      eventType: "GOVERNANCE_DECISION",
      createdBy: principal.principalId,
      metadata: {
        uploadPrepared: status === "PENDING_UPLOAD",
        validationSummary: summarizeValidation(findings)
      } as Prisma.InputJsonValue
    }
  });

  if (status === "REJECTED") {
    return { fileAsset, validationIssues: findings, upload: null };
  }

  const objectKey = createObjectKey({
    tenantId: principal.tenantId,
    fileAssetId: fileAsset.id,
    version: fileAsset.version,
    filename: file.filename
  });

  const uploadUrl = await objectStorage.createPresignedPutUrl(
    {
      key: objectKey,
      body: "",
      metadata: {
        tenantId: principal.tenantId,
        fileAssetId: fileAsset.id
      },
      ...(file.contentType ? { contentType: file.contentType } : {})
    },
    config.INGESTION_UPLOAD_URL_TTL_SECONDS
  );

  return {
    fileAsset,
    validationIssues: findings,
    upload: {
      method: "PUT",
      url: uploadUrl,
      objectKey,
      headers: file.contentType ? { "content-type": file.contentType } : {}
    }
  };
}

async function createValidationIssues(
  tenantId: string,
  fileAssetId: string,
  datasetId: string | undefined,
  findings: ValidationFinding[]
): Promise<void> {
  await prisma.validationIssue.createMany({
    data: findings.map((finding) => ({
      tenantId,
      fileAssetId,
      ...(datasetId ? { datasetId } : {}),
      severity: finding.severity,
      code: finding.code,
      message: finding.message,
      ...(finding.path ? { path: finding.path } : {}),
      metadata: (finding.metadata ?? {}) as Prisma.InputJsonValue
    }))
  });
}

async function createProcessingJobs(
  fileAssetId: string,
  tenantId: string,
  datasetId: string | null,
  kind: string,
  payload: { objectKey: string }
): Promise<unknown[]> {
  const jobTypes: ProcessingJobType[] = ["METADATA_EXTRACTION", "VALIDATE_FILE"];

  if (kind === "SPREADSHEET") {
    jobTypes.push("PARSE_SPREADSHEET");
  }

  if (kind === "PDF") {
    jobTypes.push("PARSE_PDF", "OCR");
  }

  if (kind === "IMAGE") {
    jobTypes.push("PARSE_IMAGE", "OCR");
  }

  const jobs = [];
  for (const type of jobTypes) {
    const job = await prisma.processingJob.create({
      data: {
        tenantId,
        fileAssetId,
        ...(datasetId ? { datasetId } : {}),
        type,
        queueName: config.INGESTION_QUEUE_NAME,
        payload
      }
    });

    await enqueueIngestionJob(
      {
        redisUrl: config.REDIS_URL,
        queueName: config.INGESTION_QUEUE_NAME
      },
      {
        tenantId,
        fileAssetId,
        ...(datasetId ? { datasetId } : {}),
        jobId: job.id,
        type,
        objectKey: payload.objectKey
      },
      { jobId: job.id }
    );

    jobs.push(job);
  }

  return jobs;
}

function parsePrincipalHeader(value: string | undefined): AuthenticatedPrincipal | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as AuthenticatedPrincipal;
  } catch {
    return null;
  }
}

async function isClientUserUsageEnabled(tenantId: string): Promise<boolean> {
  const policy = await prisma.clientBillingPolicy.findFirst({
    where: {
      tenantId,
      status: "ACTIVE"
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
  return jsonBoolean(policy?.metadata, "clientUserUsageEnabled");
}

function jsonBoolean(value: Prisma.JsonValue | undefined, key: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return value[key] === true;
}

function hasPermission(principal: AuthenticatedPrincipal, permission: string): boolean {
  return principal.permissions.includes(permission) || principal.permissions.includes("*:*");
}

async function findAccessibleConversation(
  principal: AuthenticatedPrincipal,
  conversationId: string
): Promise<{ id: string } | null> {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      tenantId: principal.tenantId,
      status: { not: "DELETED" },
      ...(hasPermission(principal, "chat:admin") ? {} : { ownerUserId: principal.principalId })
    },
    select: { id: true }
  });
}

function isBiMasterPrincipal(principal: AuthenticatedPrincipal): boolean {
  return principal.roles.some((role) => ["BI_SUPER_ADMIN", "BI_OPERATIONS_ADMIN"].includes(role));
}

async function canManageInsightArtifact(
  principal: AuthenticatedPrincipal,
  insightId: string
): Promise<boolean> {
  const artifact = await prisma.insightArtifact.findUnique({
    where: { id: insightId },
    select: { tenantId: true }
  });
  if (!artifact) {
    return false;
  }
  return artifact.tenantId === principal.tenantId || isBiMasterPrincipal(principal);
}

async function writePlatformAudit(
  principal: AuthenticatedPrincipal,
  action: string,
  resource: string,
  resourceId: string,
  requestId: string
): Promise<void> {
  await writeBillingAudit(principal, action, resource, resourceId, requestId);
}

async function writeBillingAudit(
  principal: AuthenticatedPrincipal,
  action: string,
  resource: string,
  resourceId: string,
  requestId: string
): Promise<void> {
  const envelope = createAuditEnvelope(
    {
      tenantId: principal.tenantId,
      actorType: principal.principalType,
      actorId: principal.principalId,
      action,
      resource,
      resourceId,
      outcome: "SUCCESS",
      requestId
    },
    config.AUDIT_HASH_SECRET
  );

  await prisma.auditEvent.create({
    data: {
      ...(envelope.tenantId ? { tenantId: envelope.tenantId } : {}),
      ...(envelope.actorType ? { actorType: envelope.actorType } : {}),
      ...(envelope.actorId ? { actorId: envelope.actorId } : {}),
      action: envelope.action,
      resource: envelope.resource,
      ...(envelope.resourceId ? { resourceId: envelope.resourceId } : {}),
      outcome: envelope.outcome,
      metadata: {},
      ...(envelope.requestId ? { requestId: envelope.requestId } : {}),
      hash: envelope.hash,
      createdAt: envelope.createdAt
    }
  });
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

const shutdown = async (): Promise<void> => {
  await app.close();
  redis.disconnect();
  await prisma.$disconnect();
};

process.once("SIGINT", () => {
  void shutdown();
});

process.once("SIGTERM", () => {
  void shutdown();
});

await app.listen({
  host: config.API_HOST,
  port: config.API_PORT
});
