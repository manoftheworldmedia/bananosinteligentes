import { createConnection, type Socket } from "node:net";
import { randomUUID } from "node:crypto";
import type { IngestionJobPayload } from "./types.js";

export interface IngestionQueueConfig {
  redisUrl: string;
  queueName: string;
}

export interface IngestionWorkerHandle {
  close(): Promise<void>;
}

export async function enqueueIngestionJob(
  config: IngestionQueueConfig,
  payload: IngestionJobPayload,
  options: { jobId?: string } = {}
): Promise<string> {
  const jobId = options.jobId ?? randomUUID();
  await redisCommand(config.redisUrl, [
    "LPUSH",
    queueKey(config.queueName),
    JSON.stringify({ ...payload, jobId })
  ]);
  return jobId;
}

export function createIngestionWorker(
  config: IngestionQueueConfig,
  processor: (payload: IngestionJobPayload) => Promise<void>
): IngestionWorkerHandle {
  let closed = false;
  let activeSocket: Socket | undefined;

  const loop = async (): Promise<void> => {
    while (!closed) {
      try {
        const response = await redisCommand(config.redisUrl, [
          "BRPOP",
          queueKey(config.queueName),
          "5"
        ]);
        const payloadText = parseBrpopPayload(response);
        if (!payloadText) {
          continue;
        }
        await processor(JSON.parse(payloadText) as IngestionJobPayload);
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (closed) {
          return;
        }
        console.error(error);
      }
    }
  };

  void loop();

  return {
    async close() {
      closed = true;
      activeSocket?.destroy();
      await Promise.resolve();
    }
  };

  function redisCommand(url: string, parts: string[]): Promise<string> {
    return sendRedisCommand(url, parts, (socket) => {
      activeSocket = socket;
    });
  }
}

function queueKey(queueName: string): string {
  return `queue:${queueName}`;
}

async function redisCommand(redisUrl: string, parts: string[]): Promise<string> {
  return sendRedisCommand(redisUrl, parts);
}

async function sendRedisCommand(
  redisUrl: string,
  parts: string[],
  onSocket?: (socket: Socket) => void
): Promise<string> {
  const url = new URL(redisUrl);
  const socket = createConnection({
    host: url.hostname,
    port: Number(url.port || 6379)
  });
  onSocket?.(socket);

  return new Promise((resolve, reject) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.once("error", reject);
    socket.on("data", (chunk) => {
      buffer += String(chunk);
      if (isCompleteRedisResponse(buffer)) {
        socket.end();
        resolve(buffer);
      }
    });
    socket.once("connect", () => {
      socket.write(encodeResp(parts));
    });
  });
}

function encodeResp(parts: string[]): string {
  return `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("")}`;
}

function isCompleteRedisResponse(response: string): boolean {
  if (response.startsWith("+") || response.startsWith("-") || response.startsWith(":")) {
    return response.endsWith("\r\n");
  }

  if (response.startsWith("$-1")) {
    return response.endsWith("\r\n");
  }

  if (response.startsWith("*-1")) {
    return response.endsWith("\r\n");
  }

  if (response.startsWith("*")) {
    return response.endsWith("\r\n");
  }

  return response.length > 0;
}

function parseBrpopPayload(response: string): string | null {
  if (response.startsWith("*-1")) {
    return null;
  }

  const parts = response.split("\r\n");
  return parts.length >= 5 ? (parts[4] ?? null) : null;
}
