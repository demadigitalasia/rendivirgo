import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuditService } from "../audit/audit.service";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CustomerAuthService, CUSTOMER_SESSION_COOKIE_NAME } from "./customer-auth.service";
import { CustomerAvatarService } from "./customer-avatar.service";
import { WholesaleApplicationsService } from "./wholesale-applications.service";
import { WholesaleRequestDto } from "./customer-auth.dto";
import { CustomerGuard } from "./customer.guard";
import { ChangeCustomerPasswordDto, CustomerForgotPasswordDto, CustomerLoginDto, CustomerRegisterDto, CustomerResetPasswordDto, CustomerVerifyEmailDto, UpdateCustomerProfileDto } from "./customer-auth.dto";

@Public()
@Controller("customer-auth")
export class CustomerAuthController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  private emailLanguage(request: Request): "en" | "id" {
    const header = request.headers["accept-language"];
    const preferred = (Array.isArray(header) ? header[0] : header)?.split(",")[0]?.trim().toLowerCase();
    return preferred?.startsWith("id") ? "id" : "en";
  }

  private cookieOptions(expires?: Date) {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: this.config.get("NODE_ENV") === "production",
      path: "/",
      ...(expires ? { expires } : {}),
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  async register(@Body() dto: CustomerRegisterDto, @Req() request: Request) {
    await this.rateLimit.consume("customer-register", request.ip, 5, 60_000);
    await this.rateLimit.consume("customer-register-account", dto.email.trim().toLowerCase(), 5, 60_000);
    const result = await this.auth.register(dto, this.emailLanguage(request));
    await this.audit.log({
      action: "customer_auth.registration_requested",
      entityType: "Customer",
      summary: "Customer registration request processed",
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return result;
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("resend-verification")
  async resendVerification(@Body() dto: CustomerRegisterDto, @Req() request: Request) {
    await this.rateLimit.consume("customer-resend-verification", request.ip, 3, 60_000);
    await this.rateLimit.consume("customer-resend-verification-account", dto.email.trim().toLowerCase(), 1, 2 * 60_000);
    const result = await this.auth.resendVerification(dto.email, this.emailLanguage(request), dto.next);
    await this.audit.log({
      action: "customer_auth.verification_requested",
      entityType: "Customer",
      summary: "Customer verification email request processed",
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return result;
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("verify-email")
  async verifyEmail(@Body() dto: CustomerVerifyEmailDto, @Req() request: Request) {
    await this.rateLimit.consume("customer-verify-email", request.ip, 10, 60_000);
    const result = await this.auth.verifyEmail(dto.token, dto.name, dto.password);
    await this.audit.log({
      action: "customer_auth.email_verified",
      entityType: "Customer",
      summary: "Customer email verification completed",
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return result;
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("login")
  async login(@Body() dto: CustomerLoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.rateLimit.consume("customer-login", request.ip, 8, 60_000);
    await this.rateLimit.consume("customer-login-account", dto.email.trim().toLowerCase(), 20, 60_000);
    const customer = await this.auth.validateCredentials(dto.email, dto.password);
    if (!customer) {
      await this.audit.log({
        action: "customer_auth.login_failed",
        entityType: "Customer",
        summary: "Failed customer login attempt",
        ip: request.ip ?? null,
        userAgent: request.headers["user-agent"] ?? null,
      });
      throw new UnauthorizedException("Invalid email or password");
    }
    const session = await this.auth.createSession(customer.id, {
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    response.cookie(CUSTOMER_SESSION_COOKIE_NAME, session.token, this.cookieOptions(session.expiresAt));
    await this.audit.log({
      action: "customer_auth.login",
      entityType: "Customer",
      entityId: customer.id,
      summary: "Customer signed in",
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return { customer, expiresAt: session.expiresAt };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  async forgotPassword(@Body() dto: CustomerForgotPasswordDto, @Req() request: Request) {
    await this.rateLimit.consume("customer-forgot-password", request.ip, 5, 60_000);
    await this.rateLimit.consume("customer-forgot-password-account", dto.email.trim().toLowerCase(), 3, 60_000);
    await this.auth.requestPasswordReset(dto.email);
    await this.audit.log({
      action: "customer_auth.password_reset_requested",
      entityType: "Customer",
      summary: "Customer password reset request processed",
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return { ok: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reset-password")
  async resetPassword(@Body() dto: CustomerResetPasswordDto, @Req() request: Request) {
    await this.rateLimit.consume("customer-reset-password", request.ip, 5, 60_000);
    const customerId = await this.auth.resetPassword(dto.token, dto.newPassword);
    if (!customerId) throw new BadRequestException("This reset link is invalid or has expired");
    await this.audit.log({
      action: "customer_auth.password_reset",
      entityType: "Customer",
      entityId: customerId,
      summary: "Customer password reset completed; active sessions revoked",
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return { ok: true };
  }
}

@Public()
@UseGuards(CustomerGuard)
@Controller("customer-account")
export class CustomerAccountController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly wholesale: WholesaleApplicationsService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly avatars: CustomerAvatarService,
  ) {}

  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.profile(request.customer!.id);
  }

  @Post("logout")
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    const token = (request.cookies as Record<string, string> | undefined)?.[CUSTOMER_SESSION_COOKIE_NAME];
    if (token) await this.auth.revokeSession(token);
    response.clearCookie(CUSTOMER_SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get("NODE_ENV") === "production",
      path: "/",
    });
    await this.audit.log({
      action: "customer_auth.logout",
      entityType: "Customer",
      entityId: request.customer!.id,
      summary: "Customer signed out",
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return { ok: true };
  }

  @Patch("profile")
  async updateProfile(@Req() request: AuthenticatedRequest, @Body() dto: UpdateCustomerProfileDto) {
    const profile = await this.auth.updateProfile(request.customer!.id, dto);
    await this.audit.log({
      action: "customer.profile.updated",
      entityType: "Customer",
      entityId: request.customer!.id,
      summary: "Customer profile details updated",
      metadata: { fields: Object.keys(dto) },
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return profile;
  }

  @Post("change-password")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(@Req() request: AuthenticatedRequest, @Body() dto: ChangeCustomerPasswordDto) {
    await this.rateLimit.consume("customer-change-password", request.customer!.id, 5, 60_000);
    const token = (request.cookies as Record<string, string> | undefined)?.[CUSTOMER_SESSION_COOKIE_NAME];
    const changed = await this.auth.changePassword(request.customer!.id, dto.currentPassword, dto.newPassword, token);
    if (!changed) throw new UnauthorizedException("Current password is incorrect");
    await this.audit.log({
      action: "customer_auth.password_changed",
      entityType: "Customer",
      entityId: request.customer!.id,
      summary: "Customer password changed; other sessions revoked",
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return { ok: true };
  }

  @Post("avatar")
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (file.mimetype !== "image/jpeg" && file.mimetype !== "image/png") {
        callback(new BadRequestException("Only JPEG or PNG profile photos are accepted."), false);
        return;
      }
      callback(null, true);
    },
  }))
  async updateAvatar(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    await this.rateLimit.consume("customer-avatar-upload", request.customer!.id, 10, 60 * 60_000);
    await this.avatars.update(request.customer!.id, file, {
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return this.auth.profile(request.customer!.id);
  }

  @Delete("avatar")
  async removeAvatar(@Req() request: AuthenticatedRequest) {
    await this.avatars.remove(request.customer!.id, {
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return this.auth.profile(request.customer!.id);
  }

  @Get("sessions")
  async sessions(@Req() request: AuthenticatedRequest) {
    const currentSessionId = request.customerSession!.id;
    const sessions = await this.auth.listSessions(request.customer!.id);
    return sessions.map((session) => ({ ...session, current: session.id === currentSessionId }));
  }

  @Delete("sessions/:id")
  async revokeSession(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Res({ passthrough: true }) response: Response) {
    const revoked = await this.auth.revokeSessionById(request.customer!.id, id);
    const isCurrent = request.customerSession!.id === id;
    if (isCurrent) {
      response.clearCookie(CUSTOMER_SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: this.config.get("NODE_ENV") === "production",
        path: "/",
      });
    }
    if (revoked) await this.audit.log({
      action: "customer_auth.session_revoked",
      entityType: "Customer",
      entityId: request.customer!.id,
      summary: isCurrent ? "Customer signed out this session" : "Customer revoked another session",
      metadata: { sessionId: id },
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return { ok: true, currentSessionRevoked: isCurrent && revoked };
  }

  @Post("sessions/revoke-others")
  async revokeOtherSessions(@Req() request: AuthenticatedRequest) {
    const count = await this.auth.revokeOtherSessions(request.customer!.id, request.customerSession!.id);
    if (count) await this.audit.log({
      action: "customer_auth.other_sessions_revoked",
      entityType: "Customer",
      entityId: request.customer!.id,
      summary: "Customer signed out other active sessions",
      metadata: { count },
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
    return { ok: true, revokedCount: count };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("wholesale-request")
  async requestWholesaleAccess(@Req() request: AuthenticatedRequest, @Body() dto: WholesaleRequestDto) {
    const result = await this.wholesale.request(request.customer!.id, dto);
    if (result.requestCreated) {
      await this.audit.log({
        action: "customer.wholesale_access.requested",
        entityType: "Customer",
        entityId: request.customer!.id,
        summary: "Customer requested Wholesale access",
        ip: request.ip ?? null,
        userAgent: request.headers["user-agent"] ?? null,
      });
    }
    return result;
  }

  @Get("orders")
  orders(@Req() request: AuthenticatedRequest, @Query("page") rawPage?: string) {
    const parsed = Number(rawPage ?? 1);
    const page = Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
    return this.auth.listOrders(request.customer!.id, page);
  }

  @Get("orders/:orderNumber")
  orderDetail(@Req() request: AuthenticatedRequest, @Param("orderNumber") orderNumber: string) {
    return this.auth.orderDetail(request.customer!.id, orderNumber);
  }
}
