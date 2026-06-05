import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export type PrincipalType = "USER" | "SERVICE_ACCOUNT";

export interface AuthenticatedPrincipal {
  principalType: PrincipalType;
  principalId: string;
  tenantId: string;
  email?: string;
  roles: string[];
  permissions: string[];
}

export interface AccessTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  typ: PrincipalType;
  tid: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface PasswordHasher {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, passwordHash: string): Promise<boolean>;
}

export interface TokenIssuer {
  issueTokenPair(principal: AuthenticatedPrincipal): Promise<TokenPair>;
}

export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly pepper: string) {}

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derived = (await scrypt(`${password}${this.pepper}`, salt, 64)) as Buffer;
    return `scrypt:${salt}:${derived.toString("hex")}`;
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    const [algorithm, salt, stored] = passwordHash.split(":");
    if (algorithm !== "scrypt" || !salt || !stored) {
      return false;
    }

    const derived = (await scrypt(`${password}${this.pepper}`, salt, 64)) as Buffer;
    const storedBuffer = Buffer.from(stored, "hex");
    return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
  }
}

export function requireTenant(principal: AuthenticatedPrincipal, tenantId: string): void {
  if (principal.tenantId !== tenantId) {
    throw new Error("Principal is not authorized for the requested tenant.");
  }
}
