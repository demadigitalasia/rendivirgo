import { Body, Controller, Delete, Get, Param, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CurrentAdmin } from "../common/decorators/current-admin.decorator";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedAdmin, AuthenticatedRequest } from "../common/types/authenticated-request";
import { AuditService } from "../audit/audit.service";
import { AuthService, SESSION_COOKIE_NAME } from "./auth.service";
import { ChangePasswordDto, LoginDto, UpdateProfileDto } from "./dto/auth.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(expires?: Date) {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: this.config.get("NODE_ENV") === "production",
      path: "/",
      ...(expires ? { expires } : {}),
    };
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const admin = await this.authService.validateCredentials(dto.email, dto.password);
    if (!admin) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const { token, expiresAt } = await this.authService.createSession(admin.id, {
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });

    response.cookie(SESSION_COOKIE_NAME, token, this.cookieOptions(expiresAt));

    await this.auditService.log({
      adminId: admin.id,
      action: "auth.login",
      entityType: "Admin",
      entityId: admin.id,
      summary: `${admin.email} signed in`,
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });

    return { admin, expiresAt };
  }

  @Post("logout")
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    const token = (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE_NAME];
    if (token) {
      await this.authService.revokeSession(token);
    }
    response.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
    await this.auditService.log({
      adminId: request.admin?.id,
      action: "auth.logout",
      entityType: "Admin",
      entityId: request.admin?.id,
      summary: `${request.admin?.email ?? "unknown"} signed out`,
      ip: request.ip ?? null,
    });
    return { ok: true };
  }

  @Get("me")
  me(@CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: AuthenticatedRequest) {
    return { admin, session: { expiresAt: request.adminSession?.expiresAt } };
  }

  @Post("change-password")
  async changePassword(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: ChangePasswordDto, @Req() request: AuthenticatedRequest) {
    const token = (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE_NAME];
    const changed = await this.authService.changePassword(admin.id, dto.currentPassword, dto.newPassword, token);
    if (!changed) {
      throw new UnauthorizedException("Current password is incorrect");
    }
    await this.auditService.log({
      adminId: admin.id,
      action: "auth.change_password",
      entityType: "Admin",
      entityId: admin.id,
      summary: "Admin password changed; other sessions revoked",
      ip: request.ip ?? null,
    });
    return { ok: true };
  }

  @Post("profile")
  async updateProfile(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: UpdateProfileDto, @Req() request: AuthenticatedRequest) {
    const updated = await this.authService.updateProfile(admin.id, dto);
    await this.auditService.log({
      adminId: admin.id,
      action: "auth.update_profile",
      entityType: "Admin",
      entityId: admin.id,
      summary: "Admin profile updated",
      metadata: dto,
      ip: request.ip ?? null,
    });
    return { admin: updated };
  }

  @Get("sessions")
  sessions(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.authService.listSessions(admin.id);
  }

  @Delete("sessions/:id")
  async revokeSession(@CurrentAdmin() admin: AuthenticatedAdmin, @Param("id") id: string, @Req() request: AuthenticatedRequest) {
    await this.authService.revokeSessionById(admin.id, id);
    await this.auditService.log({
      adminId: admin.id,
      action: "auth.revoke_session",
      entityType: "AdminSession",
      entityId: id,
      summary: "Session revoked",
      ip: request.ip ?? null,
    });
    return { ok: true };
  }
}
