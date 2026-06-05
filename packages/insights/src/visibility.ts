import type { AuthenticatedPrincipal } from "@bananos/core";
import type { Prisma } from "@bananos/database";

export function insightVisibilityWhere(
  principal: AuthenticatedPrincipal
): Prisma.InsightArtifactWhereInput {
  const internal =
    principal.permissions.includes("insight:admin") || principal.permissions.includes("*:*");
  return {
    OR: [
      {
        tenantId: principal.tenantId,
        scope: "TENANT",
        ...(canManageInsights(principal) ? {} : { status: "PUBLISHED" as const })
      },
      {
        tenantId: null,
        scope: {
          in: internal ? ["COHORT", "NETWORK", "GLOBAL", "INTERNAL"] : ["NETWORK", "GLOBAL"]
        },
        status: "PUBLISHED"
      }
    ]
  };
}

export function canManageInsights(principal: AuthenticatedPrincipal): boolean {
  return (
    principal.permissions.includes("insight:admin") ||
    principal.permissions.includes("insight:create") ||
    principal.permissions.includes("*:*")
  );
}

export function canReviewInsights(principal: AuthenticatedPrincipal): boolean {
  return principal.permissions.includes("insight:review") || principal.permissions.includes("*:*");
}
