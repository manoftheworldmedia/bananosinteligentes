import { z } from "zod";

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === "boolean" ? value : value.toLowerCase() === "true"));

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "development", "staging", "production"]).default("local"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  INGESTION_QUEUE_NAME: z.string().min(1).default("ingestion"),
  INGESTION_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  GRAPH_OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  GRAPH_OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(50),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  JWT_PRIVATE_KEY_BASE64: z.string().optional().default(""),
  JWT_PUBLIC_KEY_BASE64: z.string().optional().default(""),
  OBJECT_STORAGE_PROVIDER: z.enum(["s3"]).default("s3"),
  OBJECT_STORAGE_ENDPOINT: z.string().url(),
  OBJECT_STORAGE_REGION: z.string().min(1).default("us-east-1"),
  OBJECT_STORAGE_BUCKET: z.string().min(1),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(1),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(1),
  OBJECT_STORAGE_FORCE_PATH_STYLE: booleanFromString.default(true),
  PASSWORD_PEPPER: z.string().min(16),
  AUDIT_HASH_SECRET: z.string().min(16)
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}
