import type { AuthenticatedPrincipal } from "@bananos/core";
import type { Prisma } from "@bananos/database";

export function graphVisibilityWhere(
  principal: AuthenticatedPrincipal
): Prisma.GraphNodeWhereInput {
  const internal =
    principal.permissions.includes("graph:admin") || principal.permissions.includes("*:*");
  return {
    OR: [
      { tenantId: principal.tenantId },
      {
        tenantId: null,
        partition: {
          in: internal
            ? ["SHARED_CONCEPT", "INSIGHTS", "NETWORK_PROJECTION", "INTERNAL"]
            : ["SHARED_CONCEPT", "INSIGHTS", "NETWORK_PROJECTION"]
        },
        visibilityScope: {
          in: internal ? ["global", "network", "internal"] : ["global", "network"]
        }
      }
    ]
  };
}
