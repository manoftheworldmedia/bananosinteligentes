import { createHmac } from "node:crypto";

export type AuditOutcome = "SUCCESS" | "DENIED" | "FAILURE";

export interface AuditActor {
  actorType?: "USER" | "SERVICE_ACCOUNT";
  actorId?: string;
  tenantId?: string;
}

export interface AuditEventInput extends AuditActor {
  action: string;
  resource: string;
  resourceId?: string;
  outcome: AuditOutcome;
  policyDecision?: unknown;
  metadata?: Record<string, unknown>;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditEventEnvelope extends AuditEventInput {
  hash: string;
  createdAt: string;
}

export function createAuditEnvelope(input: AuditEventInput, secret: string): AuditEventEnvelope {
  const createdAt = new Date().toISOString();
  const hash = createAuditHash({ ...input, createdAt }, secret);
  return { ...input, createdAt, hash };
}

export function createAuditHash(payload: unknown, secret: string): string {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}
