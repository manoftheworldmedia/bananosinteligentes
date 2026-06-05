export type PolicyEffect = "ALLOW" | "DENY";
export type PolicyStatus = "DRAFT" | "ACTIVE" | "DEPRECATED" | "ARCHIVED";
export type ConsentState = "REQUESTED" | "GRANTED" | "DENIED" | "REVOKED" | "EXPIRED" | "SUSPENDED";

export interface GovernanceContext {
  tenantId: string;
  resource: string;
  action: string;
  purpose?: string;
  consentState?: ConsentState;
  attributes?: Record<string, unknown>;
}

export interface GovernancePolicy {
  key: string;
  version: number;
  status: PolicyStatus;
  effect: PolicyEffect;
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export interface GovernanceDecision {
  allowed: boolean;
  effect: PolicyEffect;
  policyKey?: string;
  reason: string;
}

export function decidePolicy(
  context: GovernanceContext,
  policies: GovernancePolicy[]
): GovernanceDecision {
  if (context.consentState && context.consentState !== "GRANTED") {
    return {
      allowed: false,
      effect: "DENY",
      reason: `consent_${context.consentState.toLowerCase()}`
    };
  }

  const activeMatches = policies.filter(
    (policy) =>
      policy.status === "ACTIVE" &&
      (policy.resource === context.resource || policy.resource === "*") &&
      (policy.action === context.action || policy.action === "*")
  );

  const deny = activeMatches.find((policy) => policy.effect === "DENY");
  if (deny) {
    return {
      allowed: false,
      effect: "DENY",
      policyKey: deny.key,
      reason: "explicit_deny"
    };
  }

  const allow = activeMatches.find((policy) => policy.effect === "ALLOW");
  if (allow) {
    return {
      allowed: true,
      effect: "ALLOW",
      policyKey: allow.key,
      reason: "explicit_allow"
    };
  }

  return {
    allowed: false,
    effect: "DENY",
    reason: "default_deny"
  };
}
