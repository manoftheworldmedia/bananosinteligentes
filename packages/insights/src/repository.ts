import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@bananos/database";

export interface EvidenceInput {
  tenantId?: string;
  evidenceType:
    | "CANONICAL_RECORD"
    | "AGGREGATED_METRIC"
    | "GRAPH_PATH"
    | "PRIOR_INSIGHT"
    | "PUBLIC_RESEARCH"
    | "EXPERT_NOTE"
    | "MODEL_OUTPUT"
    | "EXPERIMENT_RESULT"
    | "WEATHER_DATA"
    | "GEOSPATIAL_DATA";
  sourceRef: Record<string, unknown>;
  ownerType: "CLIENT" | "BANANOS" | "PUBLIC" | "PARTNER" | "MIXED";
  visibilityScope: string;
  strength?: number;
  qualityScore?: number;
  observedAt?: Date;
  citation?: string;
  policyId?: string;
  consentGrantId?: string;
  metadata?: Record<string, unknown>;
}

export interface SubjectInput {
  tenantId?: string;
  entityType: string;
  entityId: string;
  relationship?: string;
  metadata?: Record<string, unknown>;
}

export interface ContributionInput {
  tenantId?: string;
  contributionRef: Record<string, unknown>;
  weight?: number;
  consentGrantId?: string;
  revocationBehavior: "RETAIN_TENANT_ONLY" | "RECOMPUTE" | "REDACT" | "RECALL" | "ARCHIVE";
  anonymized?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateInsightInput {
  tenantId?: string;
  artifactType:
    | "FINDING"
    | "RECOMMENDATION"
    | "FORECAST"
    | "BENCHMARK"
    | "RISK_SCORE"
    | "PLAYBOOK"
    | "HYPOTHESIS"
    | "EXPERIMENT_RESULT"
    | "ALERT"
    | "MODEL_EVALUATION";
  scope: "TENANT" | "COHORT" | "NETWORK" | "GLOBAL" | "INTERNAL";
  title: string;
  summary: string;
  visibilityScope: string;
  cohortId?: string;
  confidenceScore: number;
  confidenceRationale?: string;
  impactEstimate?: Record<string, unknown>;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  generationMethod:
    | "HUMAN_AUTHORED"
    | "RULE_BASED"
    | "STATISTICAL"
    | "MODEL_GENERATED"
    | "HYBRID"
    | "NETWORK_AGGREGATION";
  modelId?: string;
  promptVersion?: string;
  policyId?: string;
  consentGrantId?: string;
  consentBasis?: Record<string, unknown>;
  revocationBehavior?: "RETAIN_TENANT_ONLY" | "RECOMPUTE" | "REDACT" | "RECALL" | "ARCHIVE";
  validFrom?: Date;
  validUntil?: Date;
  supersedesInsightId?: string;
  createdBy?: string;
  structuredClaims?: unknown[];
  recommendations?: unknown[];
  content?: Record<string, unknown>;
  evidence?: EvidenceInput[];
  subjects?: SubjectInput[];
  contributions?: ContributionInput[];
  metadata?: Record<string, unknown>;
}

export async function createInsight(
  prisma: PrismaClient,
  input: CreateInsightInput
): Promise<{ id: string; version: number }> {
  validateInsightScope(input);
  const reviewRequired = requiresHumanReview(input);
  const contentHash = hashContent(input);

  return prisma.$transaction(async (transaction) => {
    const artifact = await transaction.insightArtifact.create({
      data: {
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        artifactType: input.artifactType,
        scope: input.scope,
        status: input.generationMethod === "HUMAN_AUTHORED" ? "DRAFT" : "GENERATED",
        title: input.title,
        summary: input.summary,
        ownerType: "BANANOS",
        visibilityScope: input.visibilityScope,
        ...(input.cohortId ? { cohortId: input.cohortId } : {}),
        confidenceScore: decimal(input.confidenceScore),
        ...(input.confidenceRationale ? { confidenceRationale: input.confidenceRationale } : {}),
        impactEstimate: (input.impactEstimate ?? {}) as Prisma.InputJsonValue,
        riskLevel: input.riskLevel ?? "LOW",
        generationMethod: input.generationMethod,
        ...(input.modelId ? { modelId: input.modelId } : {}),
        ...(input.promptVersion ? { promptVersion: input.promptVersion } : {}),
        reviewRequired,
        ...(input.policyId ? { policyId: input.policyId } : {}),
        ...(input.consentGrantId ? { consentGrantId: input.consentGrantId } : {}),
        consentBasis: (input.consentBasis ?? {}) as Prisma.InputJsonValue,
        revocationBehavior: input.revocationBehavior ?? "RECALL",
        ...(input.validFrom ? { validFrom: input.validFrom } : {}),
        ...(input.validUntil ? { validUntil: input.validUntil } : {}),
        ...(input.supersedesInsightId ? { supersedesInsightId: input.supersedesInsightId } : {}),
        ...(input.createdBy ? { createdBy: input.createdBy } : {}),
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
      }
    });

    const version = await transaction.insightVersion.create({
      data: {
        insightArtifactId: artifact.id,
        version: 1,
        title: input.title,
        summary: input.summary,
        structuredClaims: (input.structuredClaims ?? []) as Prisma.InputJsonValue,
        recommendations: (input.recommendations ?? []) as Prisma.InputJsonValue,
        content: (input.content ?? {}) as Prisma.InputJsonValue,
        contentHash,
        ...(input.createdBy ? { createdBy: input.createdBy } : {})
      }
    });

    if (input.evidence?.length) {
      await transaction.evidenceReference.createMany({
        data: input.evidence.map((evidence) => ({
          insightArtifactId: artifact.id,
          insightVersionId: version.id,
          ...(evidence.tenantId ? { tenantId: evidence.tenantId } : {}),
          evidenceType: evidence.evidenceType,
          sourceRef: evidence.sourceRef as Prisma.InputJsonValue,
          ownerType: evidence.ownerType,
          visibilityScope: evidence.visibilityScope,
          strength: decimal(evidence.strength ?? 0),
          qualityScore: decimal(evidence.qualityScore ?? 0),
          ...(evidence.observedAt ? { observedAt: evidence.observedAt } : {}),
          ...(evidence.citation ? { citation: evidence.citation } : {}),
          ...(evidence.policyId ? { policyId: evidence.policyId } : {}),
          ...(evidence.consentGrantId ? { consentGrantId: evidence.consentGrantId } : {}),
          metadata: (evidence.metadata ?? {}) as Prisma.InputJsonValue
        }))
      });
    }

    if (input.subjects?.length) {
      await transaction.insightSubject.createMany({
        data: input.subjects.map((subject) => ({
          insightArtifactId: artifact.id,
          ...(subject.tenantId ? { tenantId: subject.tenantId } : {}),
          entityType: subject.entityType,
          entityId: subject.entityId,
          relationship: subject.relationship ?? "SUBJECT",
          metadata: (subject.metadata ?? {}) as Prisma.InputJsonValue
        }))
      });
    }

    if (input.contributions?.length) {
      await transaction.insightContribution.createMany({
        data: input.contributions.map((contribution) => ({
          insightArtifactId: artifact.id,
          ...(contribution.tenantId ? { tenantId: contribution.tenantId } : {}),
          contributionRef: contribution.contributionRef as Prisma.InputJsonValue,
          weight: decimal(contribution.weight ?? 0),
          ...(contribution.consentGrantId ? { consentGrantId: contribution.consentGrantId } : {}),
          revocationBehavior: contribution.revocationBehavior,
          anonymized: contribution.anonymized ?? false,
          metadata: (contribution.metadata ?? {}) as Prisma.InputJsonValue
        }))
      });
    }

    return { id: artifact.id, version: 1 };
  });
}

export async function reviewInsight(
  prisma: PrismaClient,
  input: {
    insightId: string;
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "RECALLED";
    reviewerId: string;
    notes?: string;
    checklist?: Record<string, unknown>;
  }
): Promise<void> {
  const artifact = await prisma.insightArtifact.findUniqueOrThrow({
    where: { id: input.insightId }
  });
  const status =
    input.decision === "APPROVED"
      ? "APPROVED"
      : input.decision === "RECALLED"
        ? "RECALLED"
        : "UNDER_REVIEW";

  await prisma.$transaction([
    prisma.insightReview.create({
      data: {
        insightArtifactId: artifact.id,
        version: artifact.currentVersion,
        decision: input.decision,
        reviewerId: input.reviewerId,
        ...(input.notes ? { notes: input.notes } : {}),
        checklist: (input.checklist ?? {}) as Prisma.InputJsonValue
      }
    }),
    prisma.insightArtifact.update({
      where: { id: artifact.id },
      data: { status }
    })
  ]);
}

export async function createInsightVersion(
  prisma: PrismaClient,
  input: {
    insightId: string;
    title: string;
    summary: string;
    structuredClaims?: unknown[];
    recommendations?: unknown[];
    content?: Record<string, unknown>;
    createdBy?: string;
  }
): Promise<number> {
  const artifact = await prisma.insightArtifact.findUniqueOrThrow({
    where: { id: input.insightId }
  });
  const version = artifact.currentVersion + 1;
  const contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        title: input.title,
        summary: input.summary,
        structuredClaims: input.structuredClaims ?? [],
        recommendations: input.recommendations ?? [],
        content: input.content ?? {}
      })
    )
    .digest("hex");

  await prisma.$transaction([
    prisma.insightVersion.create({
      data: {
        insightArtifactId: artifact.id,
        version,
        title: input.title,
        summary: input.summary,
        structuredClaims: (input.structuredClaims ?? []) as Prisma.InputJsonValue,
        recommendations: (input.recommendations ?? []) as Prisma.InputJsonValue,
        content: (input.content ?? {}) as Prisma.InputJsonValue,
        contentHash,
        ...(input.createdBy ? { createdBy: input.createdBy } : {})
      }
    }),
    prisma.insightArtifact.update({
      where: { id: artifact.id },
      data: {
        title: input.title,
        summary: input.summary,
        currentVersion: version,
        status: artifact.generationMethod === "HUMAN_AUTHORED" ? "DRAFT" : "GENERATED",
        publishedAt: null
      }
    })
  ]);
  return version;
}

export async function publishInsight(prisma: PrismaClient, insightId: string): Promise<void> {
  const artifact = await prisma.insightArtifact.findUniqueOrThrow({
    where: { id: insightId },
    include: {
      evidence: true,
      subjects: true,
      contributions: true,
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });
  const failures = publicationFailures(artifact);
  if (failures.length) {
    throw new Error(`Insight publication blocked: ${failures.join(", ")}`);
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.insightArtifact.update({
      where: { id: insightId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date()
      }
    });
    await transaction.graphOutboxEvent.upsert({
      where: {
        idempotencyKey: `insight.published:${artifact.id}:${artifact.currentVersion}`
      },
      create: {
        ...(artifact.tenantId ? { tenantId: artifact.tenantId } : {}),
        aggregateType: "InsightArtifact",
        aggregateId: artifact.id,
        eventType: "insight.published",
        idempotencyKey: `insight.published:${artifact.id}:${artifact.currentVersion}`,
        payload: {
          insightId: artifact.id,
          version: artifact.currentVersion
        }
      },
      update: {}
    });
  });
}

function validateInsightScope(input: CreateInsightInput): void {
  if (input.scope === "TENANT" && !input.tenantId) {
    throw new Error("Tenant-scoped insights require a tenant.");
  }
  if (input.scope !== "TENANT" && input.tenantId) {
    throw new Error(
      "Shared, network, global, and internal insights cannot contain a tenant owner."
    );
  }
  if (input.scope === "COHORT" && !input.cohortId) {
    throw new Error("Cohort insights require a cohort identifier.");
  }
  if ((input.scope === "NETWORK" || input.scope === "COHORT") && !input.contributions?.length) {
    throw new Error("Cohort and network insights require contribution records.");
  }
  if (input.confidenceScore < 0 || input.confidenceScore > 1) {
    throw new Error("Confidence score must be between 0 and 1.");
  }
}

function requiresHumanReview(input: CreateInsightInput): boolean {
  return (
    input.scope === "NETWORK" ||
    input.riskLevel === "HIGH" ||
    input.riskLevel === "CRITICAL" ||
    input.confidenceScore < 0.65 ||
    input.artifactType === "RECOMMENDATION"
  );
}

function publicationFailures(artifact: {
  tenantId: string | null;
  scope: string;
  title: string;
  summary: string;
  policyId: string | null;
  consentGrantId: string | null;
  confidenceScore: Prisma.Decimal;
  reviewRequired: boolean;
  evidence: Array<{ tenantId: string | null; ownerType: string }>;
  subjects: unknown[];
  contributions: Array<{ anonymized: boolean; consentGrantId: string | null }>;
  reviews: Array<{ decision: string }>;
}): string[] {
  const failures: string[] = [];
  if (!artifact.title || !artifact.summary) failures.push("title_and_summary_required");
  if (!artifact.evidence.length) failures.push("evidence_required");
  if (!artifact.subjects.length) failures.push("subject_required");
  if (artifact.confidenceScore.toNumber() <= 0) failures.push("confidence_required");
  if (artifact.scope === "TENANT" && !artifact.tenantId) failures.push("tenant_required");
  if (artifact.scope === "NETWORK" || artifact.scope === "COHORT") {
    if (!artifact.contributions.length) failures.push("contributions_required");
    if (artifact.contributions.some((item) => !item.anonymized || !item.consentGrantId)) {
      failures.push("anonymized_consented_contributions_required");
    }
    if (artifact.evidence.some((item) => item.tenantId !== null || item.ownerType === "CLIENT")) {
      failures.push("network_evidence_must_be_aggregated");
    }
  }
  if (artifact.reviewRequired && artifact.reviews[0]?.decision !== "APPROVED") {
    failures.push("approved_review_required");
  }
  if (!artifact.policyId && !artifact.consentGrantId && artifact.scope !== "GLOBAL") {
    failures.push("policy_or_consent_basis_required");
  }
  return failures;
}

function hashContent(input: CreateInsightInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: input.title,
        summary: input.summary,
        structuredClaims: input.structuredClaims ?? [],
        recommendations: input.recommendations ?? [],
        content: input.content ?? {}
      })
    )
    .digest("hex");
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
