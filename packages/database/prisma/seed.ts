import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const permissions = [
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
];

const roles = [
  {
    key: "BI_SUPER_ADMIN",
    name: "BI Super Administrator",
    permissions: permissions.map((permission) => permission.key)
  },
  {
    key: "BI_FINANCE_ADMIN",
    name: "BI Finance Administrator",
    permissions: [
      "tenant:read",
      "billing_policy:create",
      "billing_policy:update",
      "billing_policy:read",
      "markup_rule:create",
      "markup_rule:update",
      "budget_policy:create",
      "budget_policy:update",
      "usage_summary:read",
      "internal_cost:read",
      "margin_report:read",
      "usage_export:create",
      "manual_adjustment:create",
      "insight:read",
      "graph:read",
      "chat:admin",
      "memory:admin",
      "report:read",
      "audit:read"
    ]
  },
  {
    key: "BI_OPERATIONS_ADMIN",
    name: "BI Operations Administrator",
    permissions: [
      "tenant:read",
      "usage_summary:read",
      "usage_export:create",
      "processing_job:read",
      "budget_policy:create",
      "budget_policy:update",
      "insight:read",
      "graph:read",
      "graph:review",
      "chat:admin",
      "memory:read",
      "report:read",
      "audit:read"
    ]
  },
  {
    key: "CLIENT_OWNER",
    name: "Client Owner",
    permissions: [
      "tenant:read",
      "usage_summary:read",
      "usage_export:create",
      "insight:create",
      "insight:read",
      "graph:read",
      "graph:write",
      "chat:use",
      "chat:admin",
      "memory:create",
      "memory:read",
      "memory:delete",
      "memory:admin",
      "report:generate",
      "report:read",
      "dataset:create",
      "dataset:read",
      "file_asset:create",
      "file_asset:read",
      "file_asset:update"
    ]
  },
  {
    key: "CLIENT_ADMIN",
    name: "Client Administrator",
    permissions: [
      "tenant:read",
      "usage_summary:read",
      "usage_export:create",
      "insight:create",
      "insight:read",
      "graph:read",
      "graph:write",
      "chat:use",
      "chat:admin",
      "memory:create",
      "memory:read",
      "memory:delete",
      "memory:admin",
      "report:generate",
      "report:read",
      "dataset:create",
      "dataset:read",
      "file_asset:create",
      "file_asset:read",
      "file_asset:update"
    ]
  },
  {
    key: "CLIENT_USER",
    name: "Client User",
    permissions: [
      "usage_summary:read",
      "insight:read",
      "graph:read",
      "chat:use",
      "memory:create",
      "memory:read",
      "memory:delete",
      "report:generate",
      "report:read",
      "file_asset:create",
      "file_asset:read"
    ]
  },
  {
    key: "tenant_admin",
    name: "Tenant Administrator",
    permissions: permissions.map((permission) => permission.key)
  },
  {
    key: "governance_admin",
    name: "Governance Administrator",
    permissions: [
      "tenant:read",
      "consent:read",
      "consent:administer",
      "policy:read",
      "audit:read",
      "insight:read",
      "insight:review",
      "graph:read",
      "graph:review",
      "dataset:read",
      "file_asset:read",
      "processing_job:read"
    ]
  },
  {
    key: "platform_reader",
    name: "Platform Reader",
    permissions: ["tenant:read", "user:read", "role:read", "consent:read", "policy:read"]
  }
];

async function main(): Promise<void> {
  for (const permission of permissions) {
    const existingPermission = await prisma.permission.findFirst({
      where: {
        tenantId: null,
        key: permission.key
      }
    });

    if (!existingPermission) {
      await prisma.permission.create({
        data: {
          ...permission,
          isSystem: true
        }
      });
    }
  }

  for (const role of roles) {
    const savedRole =
      (await prisma.role.findFirst({
        where: {
          tenantId: null,
          key: role.key
        }
      })) ??
      (await prisma.role.create({
        data: {
          key: role.key,
          name: role.name,
          isSystem: true
        }
      }));

    for (const permissionKey of role.permissions) {
      const permission = await prisma.permission.findFirstOrThrow({
        where: {
          tenantId: null,
          key: permissionKey
        }
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: savedRole.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: savedRole.id,
          permissionId: permission.id
        }
      });
    }
  }

  const localProvider = await prisma.aiProvider.upsert({
    where: { key: "bananos-local" },
    update: {},
    create: {
      key: "bananos-local",
      name: "Bananos Local Evidence Synthesis",
      status: "ACTIVE",
      metadata: { purpose: "Grounded development and fallback orchestration" }
    }
  });
  await prisma.aiModel.upsert({
    where: {
      providerId_key: {
        providerId: localProvider.id,
        key: "evidence-synthesis-v1"
      }
    },
    update: {},
    create: {
      providerId: localProvider.id,
      key: "evidence-synthesis-v1",
      name: "Evidence Synthesis v1",
      modality: "text",
      metadata: { externalProvider: false }
    }
  });
  if (
    !(await prisma.modelProfile.findFirst({
      where: { tenantId: null, providerKey: "bananos-local", modelKey: "evidence-synthesis-v1" }
    }))
  ) {
    await prisma.modelProfile.create({
      data: {
        providerKey: "bananos-local",
        modelKey: "evidence-synthesis-v1",
        approvedUseCases: ["banana_chat"],
        maximumRisk: "HIGH",
        costProfile: { providerUnitCost: 0 },
        evaluationSummary: { groundedFallback: true }
      }
    });
  }
  if (
    !(await prisma.promptTemplate.findFirst({
      where: { tenantId: null, key: "banana-chat-grounded-answer", version: 1 }
    }))
  ) {
    await prisma.promptTemplate.create({
      data: {
        key: "banana-chat-grounded-answer",
        version: 1,
        status: "ACTIVE",
        useCase: "banana_chat",
        template:
          "Answer using policy-filtered evidence, label memory as context, cite sources, and escalate high-risk guidance.",
        requiredContext: ["question", "authorized_memory", "authorized_evidence", "tool_outputs"],
        outputSchema: {
          fields: ["answer", "confidence", "assumptions", "recommendedActions", "escalation"]
        },
        riskLimit: "HIGH"
      }
    });
  }
}

await main();
await prisma.$disconnect();
