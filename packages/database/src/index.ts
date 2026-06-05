import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export type { PrismaClient };
export * from "@prisma/client";
