import type { AuthenticatedPrincipal } from "@bananos/core";
import { Prisma, type PrismaClient } from "@bananos/database";
import { insightVisibilityWhere } from "@bananos/insights";
import { graphVisibilityWhere } from "@bananos/knowledge-graph";
import { retrieveMemories } from "@bananos/memory";
import type { GroundingCitation } from "./provider.js";

export interface RetrievalBundle {
  recentMessages: Array<{ role: string; content: string }>;
  memory: GroundingCitation[];
  evidence: GroundingCitation[];
  fileAssets: Array<{ id: string; filename: string; status: string; analysis: unknown }>;
  summary: Record<string, unknown>;
}

export async function retrieveChatContext(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  conversationId: string,
  query: string,
  memoryEnabled = true
): Promise<RetrievalBundle> {
  const terms = queryTerms(query);
  const [recentMessages, memories, insights, graphNodes, attachments] = await Promise.all([
    prisma.chatMessage.findMany({
      where: {
        conversationId,
        tenantId: principal.tenantId,
        status: "COMPLETED"
      },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    memoryEnabled ? retrieveMemories(prisma, principal, { query, conversationId, take: 8 }) : [],
    prisma.insightArtifact.findMany({
      where: {
        AND: [
          insightVisibilityWhere(principal),
          {
            status: "PUBLISHED",
            OR: terms.flatMap((term) => [
              { title: { contains: term, mode: "insensitive" as const } },
              { summary: { contains: term, mode: "insensitive" as const } }
            ])
          }
        ]
      },
      include: { evidence: { take: 5 } },
      orderBy: [{ riskLevel: "desc" }, { publishedAt: "desc" }],
      take: 12
    }),
    prisma.graphNode.findMany({
      where: {
        AND: [
          graphVisibilityWhere(principal),
          { status: "ACTIVE", partition: { not: "INTERNAL" } },
          ...(terms.length
            ? [
                {
                  OR: terms.map((term) => ({
                    label: { contains: term, mode: "insensitive" as const }
                  }))
                }
              ]
            : [])
        ]
      },
      orderBy: { confidenceScore: "desc" },
      take: 12
    }),
    prisma.chatFileAttachment.findMany({
      where: {
        conversationId,
        fileAsset: { tenantId: principal.tenantId }
      },
      include: {
        fileAsset: {
          include: {
            validationIssues: { take: 20 },
            processingJobs: { orderBy: { createdAt: "desc" }, take: 20 }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  const memoryCitations: GroundingCitation[] = memories.map((memory) => ({
    sourceType: "MEMORY",
    sourceId: memory.id,
    memoryEntryId: memory.id,
    title: `Memory (${memory.scope.toLowerCase()})`,
    excerpt: memory.content,
    visibilityScope: memory.visibilityScope,
    confidenceScore: memory.confidenceScore,
    sourceRef: toRecord(memory.sourceRef)
  }));
  const insightCitations: GroundingCitation[] = insights.map((insight) => ({
    sourceType: "INSIGHT",
    sourceId: insight.id,
    title: insight.title,
    excerpt: insight.summary,
    visibilityScope: insight.visibilityScope,
    confidenceScore: insight.confidenceScore.toNumber(),
    sourceRef: {
      insightId: insight.id,
      scope: insight.scope,
      evidenceTypes: [...new Set(insight.evidence.map((evidence) => evidence.evidenceType))]
    }
  }));
  const graphCitations: GroundingCitation[] = graphNodes.map((node) => ({
    sourceType: "GRAPH_NODE",
    sourceId: node.id,
    title: node.label,
    excerpt: compactJson(node.properties),
    visibilityScope: node.visibilityScope,
    confidenceScore: node.confidenceScore.toNumber(),
    sourceRef: { graphNodeId: node.id, nodeType: node.nodeType, partition: node.partition }
  }));
  const fileAssets = attachments.map(({ fileAsset }) => ({
    id: fileAsset.id,
    filename: fileAsset.filename,
    status: fileAsset.status,
    analysis: {
      kind: fileAsset.kind,
      extractedMetadata: fileAsset.extractedMetadata,
      validationSummary: fileAsset.validationSummary,
      validationIssues: fileAsset.validationIssues.map((issue) => ({
        severity: issue.severity,
        code: issue.code,
        message: issue.message
      })),
      processingJobs: fileAsset.processingJobs.map((job) => ({
        type: job.type,
        status: job.status
      }))
    }
  }));
  const fileCitations: GroundingCitation[] = fileAssets.map((file) => ({
    sourceType: "FILE_ASSET",
    sourceId: file.id,
    title: file.filename,
    excerpt: compactJson(file.analysis),
    visibilityScope: "tenant",
    confidenceScore: file.status === "VALIDATED" ? 0.8 : 0.45,
    sourceRef: { fileAssetId: file.id, status: file.status }
  }));

  return {
    recentMessages: recentMessages
      .reverse()
      .map((message) => ({ role: message.role, content: message.content })),
    memory: memoryCitations,
    evidence: [...insightCitations, ...graphCitations, ...fileCitations],
    fileAssets,
    summary: {
      memoryCount: memoryCitations.length,
      insightCount: insightCitations.length,
      graphNodeCount: graphCitations.length,
      fileCount: fileCitations.length
    }
  };
}

function queryTerms(query: string): string[] {
  const terms = [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 2)
    )
  ];
  return terms.length ? terms.slice(0, 12) : ["banana"];
}

function compactJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  return serialized.length > 600 ? `${serialized.slice(0, 597)}...` : serialized;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function citationCreateData(
  messageId: string,
  traceId: string,
  citation: GroundingCitation
): Prisma.RetrievalCitationCreateManyInput {
  return {
    messageId,
    aiTraceId: traceId,
    ...(citation.memoryEntryId ? { memoryEntryId: citation.memoryEntryId } : {}),
    sourceType: citation.sourceType,
    sourceId: citation.sourceId,
    title: citation.title,
    ...(citation.excerpt ? { excerpt: citation.excerpt } : {}),
    visibilityScope: citation.visibilityScope,
    confidenceScore: new Prisma.Decimal(citation.confidenceScore),
    sourceRef: citation.sourceRef as Prisma.InputJsonValue
  };
}
