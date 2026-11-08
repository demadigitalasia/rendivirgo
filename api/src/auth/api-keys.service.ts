import { Injectable, Logger } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedAdmin } from "../common/types/authenticated-request";
import type { AdminApiKey } from "../../generated/prisma";

export const API_KEY_PREFIX = "rvk_";
const LAST_USED_BUMP_MS = 60_000;

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async createKey(adminId: string, input: { name: string; scopes: string[]; expiresInDays?: number }) {
    const token = API_KEY_PREFIX + randomBytes(32).toString("base64url");
    const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000) : null;

    const apiKey = await this.prisma.adminApiKey.create({
      data: {
        adminId,
        name: input.name.trim(),
        keyHash: this.hashToken(token),
        keyPrefix: token.slice(0, 12),
        scopes: input.scopes,
        expiresAt,
      },
    });

    return { apiKey, token };
  }

  async resolveApiKey(token: string): Promise<{ admin: AuthenticatedAdmin; apiKey: AdminApiKey } | null> {
    const apiKey = await this.prisma.adminApiKey.findUnique({
      where: { keyHash: this.hashToken(token) },
      include: { admin: true },
    });
    if (!apiKey) return null;
    if (apiKey.revokedAt) return null;
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) return null;
    if (!apiKey.admin) return null;

    if (!apiKey.lastUsedAt || Date.now() - apiKey.lastUsedAt.getTime() > LAST_USED_BUMP_MS) {
      this.prisma.adminApiKey
        .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
        .catch((error) => this.logger.warn(`Failed to bump API key lastUsedAt: ${(error as Error).message}`));
    }

    const admin: AuthenticatedAdmin = {
      id: apiKey.admin.id,
      email: apiKey.admin.email,
      name: apiKey.admin.name,
      avatarUrl: apiKey.admin.avatarUrl,
      totpEnabled: apiKey.admin.totpEnabled,
    };

    return { admin, apiKey };
  }

  listKeys(adminId: string) {
    return this.prisma.adminApiKey.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revokeKey(adminId: string, id: string) {
    await this.prisma.adminApiKey.updateMany({
      where: { id, adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
