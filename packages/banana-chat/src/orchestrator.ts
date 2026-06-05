import { MeteredAIClient } from "@bananos/billing";
import type { AuthenticatedPrincipal } from "@bananos/core";
import { Prisma, type PrismaClient } from "@bananos/database";
import { citationCreateData, retrieveChatContext } from "./retrieval.js";
import {
  LocalEvidenceSynthesisAdapter,
  type BananaChatModelAdapter,
  type ChatModelResult
} from "./provider.js";
import { executeTools, type BananaToolRequest } from "./tools.js";

export interface SendChatMessageInput {
  content: string;
  tools?: BananaToolRequest[];
}

export class BananaChatOrchestrator {
  private readonly meteredAI: MeteredAIClient;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly model: BananaChatModelAdapter = new LocalEvidenceSynthesisAdapter()
  ) {
    this.meteredAI = new MeteredAIClient(prisma);
  }

  async sendMessage(
    principal: AuthenticatedPrincipal,
    conversationId: string,
    input: SendChatMessageInput
  ): Promise<{ userMessageId: string; assistantMessageId: string; traceId: string }> {
    requirePermission(principal, "chat:use");
    const conversation = await this.prisma.conversation.findFirstOrThrow({
      where: {
        id: conversationId,
        tenantId: principal.tenantId,
        status: "ACTIVE",
        ...(hasPermission(principal, "chat:admin") ? {} : { ownerUserId: principal.principalId })
      }
    });
    const intent = classifyIntent(input.content);
    const riskLevel = classifyRisk(input.content);
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        tenantId: principal.tenantId,
        conversationId,
        userId: principal.principalId,
        role: "USER",
        status: "COMPLETED",
        content: input.content,
        riskLevel,
        completedAt: new Date()
      }
    });
    const trace = await this.prisma.aiTrace.create({
      data: {
        tenantId: principal.tenantId,
        conversationId,
        messageId: userMessage.id,
        userId: principal.principalId,
        intent,
        riskLevel,
        providerKey: this.model.providerKey,
        modelKey: this.model.modelKey,
        promptTemplateKey: "banana-chat-grounded-answer",
        promptVersion: "1",
        policyDecision: {
          allowed: true,
          tenantId: principal.tenantId,
          permissionsChecked: ["chat:use", "insight:read", "graph:read", "memory:read"]
        }
      }
    });
    const startedAt = Date.now();

    try {
      const retrieval = await retrieveChatContext(
        this.prisma,
        principal,
        conversationId,
        input.content,
        conversation.memoryEnabled
      );
      const requestedTools =
        input.tools ??
        (intent === "GENERATE_REPORT"
          ? [{ toolKey: "generate_report" as const }]
          : intent === "ANALYZE_FILE"
            ? [{ toolKey: "analyze_files" as const }]
            : []);
      const toolOutputs = await executeTools(
        this.prisma,
        principal,
        { traceId: trace.id, conversationId, retrieval },
        requestedTools
      );
      const result = await this.meteredAI.run(
        {
          tenantId: principal.tenantId,
          userId: principal.principalId,
          sourceFeature: "banana_chat.response",
          relatedType: "conversation",
          relatedId: conversationId,
          workflowKey: "banana_chat.grounded_response",
          estimatedBillableUnits: estimateTokens(input.content) + 1000,
          estimatedProviderUnitCost: this.model.providerUnitCost
        },
        {
          execute: () =>
            this.model.generate({
              question: input.content,
              intent,
              riskLevel,
              recentMessages: retrieval.recentMessages,
              memory: retrieval.memory,
              evidence: retrieval.evidence,
              toolOutputs
            }),
          usage: (output: ChatModelResult) => ({
            providerKey: this.model.providerKey,
            modelKey: this.model.modelKey,
            inputTokens: output.inputTokens,
            outputTokens: output.outputTokens,
            providerUnitCost: this.model.providerUnitCost,
            realInternalCost:
              this.model.providerUnitCost * (output.inputTokens + output.outputTokens)
          })
        }
      );
      const assistant = await this.prisma.chatMessage.create({
        data: {
          tenantId: principal.tenantId,
          conversationId,
          role: "ASSISTANT",
          status: "COMPLETED",
          content: result.content,
          structuredContent: {
            intent,
            retrievalSummary: retrieval.summary,
            tools: toolOutputs.map((tool) => tool.toolKey)
          } as Prisma.InputJsonValue,
          riskLevel,
          confidenceScore: decimal(result.confidenceScore),
          assumptions: result.assumptions,
          recommendedActions: result.recommendedActions,
          escalation: result.escalation as Prisma.InputJsonValue,
          completedAt: new Date()
        }
      });
      const citations = [...retrieval.evidence, ...retrieval.memory];
      if (citations.length) {
        await this.prisma.retrievalCitation.createMany({
          data: citations.map((citation) => citationCreateData(assistant.id, trace.id, citation))
        });
      }
      await this.prisma.aiTrace.update({
        where: { id: trace.id },
        data: {
          status: "COMPLETED",
          retrievalSummary: retrieval.summary as Prisma.InputJsonValue,
          outputValidation: {
            citationCount: citations.length,
            confidenceScore: result.confidenceScore,
            highRiskEscalationPresent: riskLevel !== "HIGH" || result.escalation.required === true
          },
          latencyMs: Date.now() - startedAt,
          completedAt: new Date()
        }
      });
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });
      return { userMessageId: userMessage.id, assistantMessageId: assistant.id, traceId: trace.id };
    } catch (error) {
      await this.prisma.aiTrace.update({
        where: { id: trace.id },
        data: {
          status: "FAILED",
          errorCode: error instanceof Error ? error.message : "chat_failed",
          latencyMs: Date.now() - startedAt,
          completedAt: new Date()
        }
      });
      throw error;
    }
  }
}

function classifyIntent(content: string): string {
  const normalized = content.toLowerCase();
  if (normalized.includes("report")) return "GENERATE_REPORT";
  if (
    normalized.includes("file") ||
    normalized.includes("spreadsheet") ||
    normalized.includes("pdf")
  )
    return "ANALYZE_FILE";
  if (normalized.includes("why") || normalized.includes("relationship")) return "GRAPH_EXPLANATION";
  return "QUESTION_ANSWERING";
}

function classifyRisk(content: string): "LOW" | "MEDIUM" | "HIGH" {
  const normalized = content.toLowerCase();
  const highRisk = [
    "chemical",
    "pesticide",
    "fungicide",
    "diagnose",
    "disease",
    "compliance",
    "safety",
    "legal"
  ];
  if (highRisk.some((term) => normalized.includes(term))) return "HIGH";
  if (
    ["recommend", "forecast", "yield", "risk", "prioritize"].some((term) =>
      normalized.includes(term)
    )
  )
    return "MEDIUM";
  return "LOW";
}

function requirePermission(principal: AuthenticatedPrincipal, permission: string): void {
  if (!hasPermission(principal, permission)) throw new Error(`Permission required: ${permission}`);
}

function hasPermission(principal: AuthenticatedPrincipal, permission: string): boolean {
  return principal.permissions.includes(permission) || principal.permissions.includes("*:*");
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
