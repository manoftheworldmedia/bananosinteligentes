export interface PermissionDescriptor {
  resource: string;
  action: string;
}

export interface PermissionCheck {
  principalPermissions: string[];
  required: PermissionDescriptor;
}

export interface PermissionDecision {
  allowed: boolean;
  requiredKey: string;
  reason: string;
}

export function permissionKey(permission: PermissionDescriptor): string {
  return `${permission.resource}:${permission.action}`;
}

export function can(check: PermissionCheck): PermissionDecision {
  const requiredKey = permissionKey(check.required);
  const allowed =
    check.principalPermissions.includes(requiredKey) || check.principalPermissions.includes("*:*");

  return {
    allowed,
    requiredKey,
    reason: allowed ? "permission_granted" : "permission_missing"
  };
}

export const systemPermissions = [
  { key: "tenant:read", resource: "tenant", action: "read" },
  { key: "tenant:administer", resource: "tenant", action: "administer" },
  { key: "user:read", resource: "user", action: "read" },
  { key: "user:create", resource: "user", action: "create" },
  { key: "user:update", resource: "user", action: "update" },
  { key: "role:read", resource: "role", action: "read" },
  { key: "role:administer", resource: "role", action: "administer" },
  { key: "consent:read", resource: "consent", action: "read" },
  { key: "consent:administer", resource: "consent", action: "administer" },
  { key: "policy:read", resource: "policy", action: "read" },
  { key: "policy:decide", resource: "policy", action: "decide" },
  { key: "audit:read", resource: "audit", action: "read" },
  { key: "object:read", resource: "object", action: "read" },
  { key: "object:create", resource: "object", action: "create" },
  { key: "dataset:create", resource: "dataset", action: "create" },
  { key: "dataset:read", resource: "dataset", action: "read" },
  { key: "file_asset:create", resource: "file_asset", action: "create" },
  { key: "file_asset:read", resource: "file_asset", action: "read" },
  { key: "file_asset:update", resource: "file_asset", action: "update" },
  { key: "processing_job:read", resource: "processing_job", action: "read" },
  { key: "billing_policy:create", resource: "billing_policy", action: "create" },
  { key: "billing_policy:update", resource: "billing_policy", action: "update" },
  { key: "billing_policy:read", resource: "billing_policy", action: "read" },
  { key: "markup_rule:create", resource: "markup_rule", action: "create" },
  { key: "markup_rule:update", resource: "markup_rule", action: "update" },
  { key: "budget_policy:create", resource: "budget_policy", action: "create" },
  { key: "budget_policy:update", resource: "budget_policy", action: "update" },
  { key: "usage_summary:read", resource: "usage_summary", action: "read" },
  { key: "internal_cost:read", resource: "internal_cost", action: "read" },
  { key: "margin_report:read", resource: "margin_report", action: "read" },
  { key: "usage_export:create", resource: "usage_export", action: "create" },
  { key: "manual_adjustment:create", resource: "manual_adjustment", action: "create" },
  { key: "insight:create", resource: "insight", action: "create" },
  { key: "insight:read", resource: "insight", action: "read" },
  { key: "insight:review", resource: "insight", action: "review" },
  { key: "insight:publish", resource: "insight", action: "publish" },
  { key: "insight:admin", resource: "insight", action: "admin" },
  { key: "graph:read", resource: "graph", action: "read" },
  { key: "graph:write", resource: "graph", action: "write" },
  { key: "graph:review", resource: "graph", action: "review" },
  { key: "graph:admin", resource: "graph", action: "admin" },
  { key: "chat:use", resource: "chat", action: "use" },
  { key: "chat:admin", resource: "chat", action: "admin" },
  { key: "memory:create", resource: "memory", action: "create" },
  { key: "memory:read", resource: "memory", action: "read" },
  { key: "memory:delete", resource: "memory", action: "delete" },
  { key: "memory:admin", resource: "memory", action: "admin" },
  { key: "report:generate", resource: "report", action: "generate" },
  { key: "report:read", resource: "report", action: "read" }
] as const;
