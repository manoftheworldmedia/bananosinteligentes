import type { AuthenticatedPrincipal } from "@bananos/core";

export type BillingRole =
  | "BI_SUPER_ADMIN"
  | "BI_FINANCE_ADMIN"
  | "BI_OPERATIONS_ADMIN"
  | "CLIENT_OWNER"
  | "CLIENT_ADMIN"
  | "CLIENT_USER";

const internalCostRoles = new Set(["BI_SUPER_ADMIN", "BI_FINANCE_ADMIN"]);
const internalUsageRoles = new Set(["BI_SUPER_ADMIN", "BI_FINANCE_ADMIN", "BI_OPERATIONS_ADMIN"]);
const clientBillableRoles = new Set([
  "CLIENT_OWNER",
  "CLIENT_ADMIN",
  "BI_SUPER_ADMIN",
  "BI_FINANCE_ADMIN"
]);
const clientAdminRoles = new Set(["CLIENT_OWNER", "CLIENT_ADMIN"]);

export function hasBillingRole(principal: AuthenticatedPrincipal, role: BillingRole): boolean {
  return principal.roles.includes(role);
}

export function canViewInternalCost(principal: AuthenticatedPrincipal): boolean {
  return principal.roles.some((role) => internalCostRoles.has(role));
}

export function canViewInternalUsage(principal: AuthenticatedPrincipal): boolean {
  return principal.roles.some((role) => internalUsageRoles.has(role));
}

export function canViewClientBillableUsage(
  principal: AuthenticatedPrincipal,
  tenantId: string
): boolean {
  return (
    principal.tenantId === tenantId && principal.roles.some((role) => clientBillableRoles.has(role))
  );
}

export function canViewOwnUsage(
  principal: AuthenticatedPrincipal,
  tenantId: string,
  userId: string,
  enabled: boolean
): boolean {
  return enabled && principal.tenantId === tenantId && principal.principalId === userId;
}

export function canViewClientTenantUsage(
  principal: AuthenticatedPrincipal,
  tenantId: string
): boolean {
  return (
    principal.tenantId === tenantId && principal.roles.some((role) => clientAdminRoles.has(role))
  );
}

export function requireInternalCostAccess(principal: AuthenticatedPrincipal): void {
  if (!canViewInternalCost(principal)) {
    throw new Error("Internal cost access denied.");
  }
}

export function requireInternalUsageAccess(principal: AuthenticatedPrincipal): void {
  if (!canViewInternalUsage(principal)) {
    throw new Error("Internal usage access denied.");
  }
}

export function requireClientBillableAccess(
  principal: AuthenticatedPrincipal,
  tenantId: string
): void {
  if (!canViewClientBillableUsage(principal, tenantId)) {
    throw new Error("Client billable usage access denied.");
  }
}
