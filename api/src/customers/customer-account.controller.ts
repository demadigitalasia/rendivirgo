import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuditService } from "../audit/audit.service";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CustomerAuthService, CUSTOMER_SESSION_COOKIE_NAME } from "./customer-auth.service";
import { CustomerGuard } from "./customer.guard";
import { CustomerForgotPasswordDto, CustomerLoginDto, CustomerRegisterDto, CustomerResetPasswordDto, CustomerVerifyEmailDto, UpdateCustomerProfileDto } from "./customer-auth.dto";

@Public()
@Controller("customer-auth")
export class CustomerAuthController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly rateLimit: AuthRateLimitService,
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

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  async register(@Body() dto: CustomerRegisterDto, @Req() request: Request) {
    await this.rateLimit.consume("customer-register", request.ip, 5, 60_000);
    await this.rateLimit.consume("customer-register-account", dto.email.trim().toLowerCase(), 5, 60_000);
    const result = await this.auth.register(dto);
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
  async resendVerification(@Body() dto: CustomerForgotPasswordDto, @Req() request: Request) {
    await this.rateLimit.consume("customer-resend-verification", request.ip, 3, 60_000);
    await this.rateLimit.consume("customer-resend-verification-account", dto.email.trim().toLowerCase(), 1, 2 * 60_000);
    const result = await this.auth.resendVerification(dto.email);
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
    const done = await this.auth.resetPassword(dto.token, dto.newPassword);
    if (!done) throw new BadRequestException("This reset link is invalid or has expired");
    await this.audit.log({
      action: "customer_auth.password_reset",
      entityType: "Customer",
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
    private readonly config: ConfigService,
    private readonly audit: AuditService,
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
  updateProfile(@Req() request: AuthenticatedRequest, @Body() dto: UpdateCustomerProfileDto) {
    return this.auth.updateProfile(request.customer!.id, dto);
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
