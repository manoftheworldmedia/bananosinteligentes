import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { createHmac, createHash } from "node:crypto";

export interface ObjectStoragePutInput {
  key: string;
  body: Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface ObjectStorageGetResult {
  body: unknown;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface ObjectStorage {
  put(input: ObjectStoragePutInput): Promise<void>;
  get(key: string): Promise<ObjectStorageGetResult>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  createPresignedPutUrl(input: ObjectStoragePutInput, expiresInSeconds: number): Promise<string>;
}

export interface S3ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3ObjectStorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async put(input: ObjectStoragePutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata
      })
    );
  }

  createPresignedPutUrl(input: ObjectStoragePutInput, expiresInSeconds: number): Promise<string> {
    return Promise.resolve(
      createS3PresignedPutUrl({
        endpoint: this.config.endpoint,
        region: this.config.region,
        bucket: this.config.bucket,
        key: input.key,
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        expiresInSeconds,
        forcePathStyle: this.config.forcePathStyle,
        ...(input.contentType ? { contentType: input.contentType } : {})
      })
    );
  }

  async get(key: string): Promise<ObjectStorageGetResult> {
    const output = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      })
    );

    const result: ObjectStorageGetResult = {
      body: output.Body
    };

    if (output.ContentType) {
      result.contentType = output.ContentType;
    }

    if (output.Metadata) {
      result.metadata = output.Metadata;
    }

    return result;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      })
    );
  }
}

function createS3PresignedPutUrl(input: {
  endpoint: string;
  region: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  forcePathStyle: boolean;
  contentType?: string;
}): string {
  const endpoint = new URL(input.endpoint);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const service = "s3";
  const credentialScope = `${dateStamp}/${input.region}/${service}/aws4_request`;
  const host = endpoint.host;
  const canonicalUri = input.forcePathStyle
    ? `/${input.bucket}/${encodeS3Path(input.key)}`
    : `/${encodeS3Path(input.key)}`;
  const url = new URL(input.forcePathStyle ? `${endpoint.origin}${canonicalUri}` : endpoint.origin);

  if (!input.forcePathStyle) {
    url.hostname = `${input.bucket}.${url.hostname}`;
    url.pathname = canonicalUri;
  }

  const signedHeaders = input.contentType ? "content-type;host" : "host";
  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", `${input.accessKeyId}/${credentialScope}`);
  url.searchParams.set("X-Amz-Date", amzDate);
  url.searchParams.set("X-Amz-Expires", String(input.expiresInSeconds));
  url.searchParams.set("X-Amz-SignedHeaders", signedHeaders);

  const canonicalQuery = Array.from(url.searchParams.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const canonicalHeaders = input.contentType
    ? `content-type:${input.contentType}\nhost:${host}\n`
    : `host:${host}\n`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD"
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join("\n");
  const signingKey = hmacBuffer(
    hmacBuffer(
      hmacBuffer(hmacBuffer(`AWS4${input.secretAccessKey}`, dateStamp), input.region),
      service
    ),
    "aws4_request"
  );
  const finalSignature = hmacHex(signingKey, stringToSign);
  url.searchParams.set("X-Amz-Signature", finalSignature);

  return url.toString();
}

function encodeS3Path(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmacBuffer(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: string | Buffer, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}
