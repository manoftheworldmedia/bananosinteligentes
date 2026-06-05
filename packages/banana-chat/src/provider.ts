export interface GroundingCitation {
  sourceType: string;
  sourceId: string;
  title: string;
  excerpt?: string;
  visibilityScope: string;
  confidenceScore: number;
  sourceRef: Record<string, unknown>;
  memoryEntryId?: string;
}

export interface ChatModelRequest {
  question: string;
  intent: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  recentMessages: Array<{ role: string; content: string }>;
  memory: GroundingCitation[];
  evidence: GroundingCitation[];
  toolOutputs: Array<{ toolKey: string; output: unknown }>;
}

export interface ChatModelResult {
  content: string;
  confidenceScore: number;
  assumptions: string[];
  recommendedActions: string[];
  escalation: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
}

export interface BananaChatModelAdapter {
  providerKey: string;
  modelKey: string;
  providerUnitCost: number;
  generate(request: ChatModelRequest): Promise<ChatModelResult>;
}

export class LocalEvidenceSynthesisAdapter implements BananaChatModelAdapter {
  readonly providerKey = "bananos-local";
  readonly modelKey = "evidence-synthesis-v1";
  readonly providerUnitCost = 0;

  generate(request: ChatModelRequest): Promise<ChatModelResult> {
    const evidence = request.evidence.slice(0, 5);
    const memory = request.memory.slice(0, 3);
    const tools = request.toolOutputs.map((tool) => tool.toolKey);
    const evidenceText =
      evidence.length > 0
        ? evidence
            .map(
              (item, index) =>
                `${index + 1}. ${item.title}: ${item.excerpt ?? "Available evidence."}`
            )
            .join("\n")
        : "No directly relevant governed evidence was found.";
    const memoryText =
      memory.length > 0
        ? `\nRelevant memory (context, not proof): ${memory.map((item) => item.title).join(", ")}.`
        : "";
    const toolText = tools.length > 0 ? `\nTools completed: ${tools.join(", ")}.` : "";
    const escalation =
      request.riskLevel === "HIGH"
        ? {
            required: true,
            reason: "High-impact agronomic or operational question requires expert review."
          }
        : {};
    const content = `Based on the authorized information available:\n\n${evidenceText}${memoryText}${toolText}`;
    return Promise.resolve({
      content,
      confidenceScore: evidence.length > 0 ? Math.min(0.9, 0.55 + evidence.length * 0.06) : 0.25,
      assumptions:
        evidence.length > 0 ? [] : ["No directly relevant governed evidence was retrieved."],
      recommendedActions:
        request.riskLevel === "HIGH"
          ? ["Review the cited evidence with an authorized agronomist before acting."]
          : [
              "Review the cited sources and refine the question with a farm, block, or crop-cycle context."
            ],
      escalation,
      inputTokens: estimateTokens(JSON.stringify(request)),
      outputTokens: estimateTokens(content)
    });
  }
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}
