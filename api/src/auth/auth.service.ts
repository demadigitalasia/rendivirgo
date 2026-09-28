import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { EmailService } from "../email/email.service";
import { renderPasswordResetEmail } from "../email/email.templates";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedAdmin } from "../common/types/authenticated-request";

export const SESSION_COOKIE_NAME = "rv_admin_session";
const RESET_TOKEN_TTL_MINUTES = 30;

export type SessionContext = {
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly ttlHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {
    this.ttlHours = Number(this.config.get("SESSION_TTL_HOURS") ?? 12);
  }

  async onModuleInit() {
    await this.ensureBootstrapAdmin();
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async ensureBootstrapAdmin() {
    const email = (this.config.get<string>("ADMIN_EMAIL") ?? "admin@rendivirgo.com").toLowerCase();
    const password = this.config.get<string>("ADMIN_PASSWORD");
    const name = this.config.get<string>("ADMIN_NAME") ?? "Rendi Virgo";

    if (!password) {
      throw new Error("ADMIN_PASSWORD must be configured before the API can bootstrap an admin account");
    }
    if (password.length < 12) {
      throw new Error("ADMIN_PASSWORD must be at least 12 characters long");
    }

    const existing = await this.prisma.admin.findUnique({ where: { email } });
    if (existing) return;

    await this.prisma.admin.create({
      data: { email, passwordHash: await bcrypt.hash(password, 12), name },
    });
    this.logger.log(`Bootstrap admin account created: ${email}`);
  }

  async validateCredentials(email: string, password: string): Promise<AuthenticatedAdmin | null> {
    const admin = await this.prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin) {
      await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");
      return null;
    }
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return null;
    return { id: admin.id, email: admin.email, name: admin.name, avatarUrl: admin.avatarUrl, totpEnabled: admin.totpEnabled };
  }

  async createSession(adminId: string, context: SessionContext) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.ttlHours * 60 * 60 * 1000);

    await this.prisma.adminSession.create({
      data: {
        adminId,
        tokenHash: this.hashToken(token),
        ip: context.ip ?? null,
        userAgent: context.userAgent?.slice(0, 400) ?? null,
        expiresAt,
      },
    });

    await this.prisma.admin.update({ where: { id: adminId }, data: { lastLoginAt: new Date() } });

    return { token, expiresAt };
  }

  async resolveSession(token: string) {
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { admin: true },
    });
    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt.getTime() < Date.now()) return null;

    const admin: AuthenticatedAdmin = {
      id: session.admin.id,
      email: session.admin.email,
      name: session.admin.name,
      avatarUrl: session.admin.avatarUrl,
      totpEnabled: session.admin.totpEnabled,
    };

    return { admin, session };
  }

  async revokeSession(token: string) {
    await this.prisma.adminSession.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listSessions(adminId: string) {
    return this.prisma.adminSession.findMany({
      where: { adminId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true },
    });
  }

  async revokeSessionById(adminId: string, sessionId: string) {
    await this.prisma.adminSession.updateMany({
      where: { id: sessionId, adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeOtherSessions(adminId: string, keepToken?: string) {
    const keepHash = keepToken ? this.hashToken(keepToken) : null;
    await this.prisma.adminSession.updateMany({
      where: {
        adminId,
        revokedAt: null,
        ...(keepHash ? { tokenHash: { not: keepHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string, keepToken?: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) return false;
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });
    await this.revokeOtherSessions(adminId, keepToken);
    return true;
  }

  async updateProfile(adminId: string, data: { name?: string; email?: string; avatarUrl?: string | null }) {
    return this.prisma.admin.update({
      where: { id: adminId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email.toLowerCase() } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
      select: { id: true, email: true, name: true, avatarUrl: true, totpEnabled: true },
    });
  }

  // ------------------------------------------------------------ password reset

  async requestPasswordReset(email: string): Promise<void> {
    const admin = await this.prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!admin) {
      this.logger.warn(`Password reset requested for unknown email ${email}`);
      return;
    }

    const token = randomBytes(32).toString("base64url");
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        resetTokenHash: this.hashToken(token),
        resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
      },
    });

    const origin = (this.config.get<string>("APP_ORIGIN") ?? "http://localhost:3000")
      .split(",")[0]
      .trim()
      .replace(/\/+$/, "");
    const link = `${origin}/admin/reset-password?token=${encodeURIComponent(token)}`;

    await this.email.send({
      to: admin.email,
      subject: "Reset your RENDI VIRGO admin password",
      html: renderPasswordResetEmail({ name: admin.name, link, expiresMinutes: RESET_TOKEN_TTL_MINUTES }),
    });

    this.logger.log(`Password reset link issued for ${admin.email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const admin = await this.prisma.admin.findFirst({
      where: {
        resetTokenHash: this.hashToken(token.trim()),
        resetTokenExpiresAt: { gt: new Date() },
      },
    });
    if (!admin) return false;

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });
    await this.prisma.adminSession.updateMany({
      where: { adminId: admin.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Password reset completed for ${admin.email}; all sessions revoked`);
    return true;
  }

  safeCompare(a: string, b: string) {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) return false;
    return timingSafeEqual(bufferA, bufferB);
  }
}
