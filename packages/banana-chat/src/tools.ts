import { recordReportUsage } from "@bananos/billing";
import type { AuthenticatedPrincipal } from "@bananos/core";
import type { Prisma, PrismaClient } from "@bananos/database";
import { getGraphNeighborhood, graphVisibilityWhere } from "@bananos/knowledge-graph";
import type { RetrievalBundle } from "./retrieval.js";

export type BananaToolKey = "generate_report" | "inspect_graph" | "analyze_files";

export interface BananaToolRequest {
  toolKey: BananaToolKey;
  input?: Record<string, unknown>;
}

export async function executeTools(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  context: {
    traceId: string;
    conversationId: string;
    retrieval: RetrievalBundle;
  },
  requests: BananaToolRequest[]
): Promise<Array<{ toolKey: string; output: unknown }>> {
  const outputs: Array<{ toolKey: string; output: unknown }> = [];
  for (const request of requests.slice(0, 5)) {
    const permission = permissionForTool(request.toolKey);
    const invocation = await prisma.toolInvocation.create({
      data: {
        tenantId: principal.tenantId,
        aiTraceId: context.traceId,
        userId: principal.principalId,
        toolKey: request.toolKey,
        permissionRequired: permission,
        input: (request.input ?? {}) as Prisma.InputJsonValue,
        status: hasPermission(principal, permission) ? "RUNNING" : "DENIED",
        startedAt: new Date()
      }
    });
    if (!hasPermission(principal, permission)) {
      outputs.push({ toolKey: request.toolKey, output: { denied: true } });
      continue;
    }

    try {
      const output = await runTool(prisma, principal, context, request);
      await prisma.toolInvocation.update({
        where: { id: invocation.id },
        data: {
          status: "SUCCEEDED",
          output: output as Prisma.InputJsonValue,
          completedAt: new Date()
        }
      });
      outputs.push({ toolKey: request.toolKey, output });
    } catch (error) {
      await prisma.toolInvocation.update({
        where: { id: invocation.id },
        data: {
          status: "FAILED",
          errorCode: error instanceof Error ? error.message : "tool_failed",
          completedAt: new Date()
        }
      });
      outputs.push({ toolKey: request.toolKey, output: { error: "tool_failed" } });
    }
  }
  return outputs;
}

async function runTool(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  context: {
    traceId: string;
    conversationId: string;
    retrieval: RetrievalBundle;
  },
  request: BananaToolRequest
): Promise<Record<string, unknown>> {
  if (request.toolKey === "analyze_files") {
    return {
      files: context.retrieval.fileAssets,
      readyCount: context.retrieval.fileAssets.filter((file) => file.status === "VALIDATED").length,
      processingCount: context.retrieval.fileAssets.filter((file) =>
        ["UPLOADED", "PROCESSING"].includes(file.status)
      ).length
    };
  }

  if (request.toolKey === "inspect_graph") {
    const nodeId = stringValue(request.input, "nodeId");
    if (!nodeId) {
      return { nodes: [], edges: [], reason: "nodeId_required" };
    }
    return getGraphNeighborhood(
      prisma,
      nodeId,
      graphVisibilityWhere(principal),
      numberValue(request.input, "depth") ?? 2
    );
  }

  const title = stringValue(request.input, "title") ?? "Banana Chat Report";
  const reportType = stringValue(request.input, "reportType") ?? "chat_evidence_summary";
  const report = await prisma.reportArtifact.create({
    data: {
      tenantId: principal.tenantId,
      conversationId: context.conversationId,
      requestedBy: principal.principalId,
      title,
      reportType,
      format: stringValue(request.input, "format") ?? "json",
      status: "READY",
      content: {
        generatedFrom: "banana_chat",
        retrievalSummary: context.retrieval.summary,
        evidence: context.retrieval.evidence.map((citation) => ({
          sourceType: citation.sourceType,
          sourceId: citation.sourceId,
          title: citation.title,
          confidenceScore: citation.confidenceScore
        })),
        fileAnalysis: context.retrieval.fileAssets
      } as Prisma.InputJsonValue,
      sourceRefs: context.retrieval.evidence.map(
        (citation) => citation.sourceRef
      ) as Prisma.InputJsonValue,
      completedAt: new Date()
    }
  });
  await recordReportUsage(
    prisma,
    {
      tenantId: principal.tenantId,
      userId: principal.principalId,
      sourceFeature: "banana_chat.report_generation",
      relatedType: "report",
      relatedId: report.id,
      workflowKey: "banana_chat.generate_report"
    },
    {
      reportType,
      pageCount: 1,
      exportFormat: report.format,
      providerUnitCost: 0,
      realInternalCost: 0
    }
  );
  return { reportId: report.id, title: report.title, status: report.status, format: report.format };
}

function permissionForTool(toolKey: BananaToolKey): string {
  if (toolKey === "generate_report") return "report:generate";
  if (toolKey === "inspect_graph") return "graph:read";
  return "file_asset:read";
}

function hasPermission(principal: AuthenticatedPrincipal, permission: string): boolean {
  return principal.permissions.includes(permission) || principal.permissions.includes("*:*");
}

function stringValue(input: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = input?.[key];
  return typeof value === "string" ? value : undefined;
}

function numberValue(input: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = input?.[key];
  return typeof value === "number" ? value : undefined;
}
