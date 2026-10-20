import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CUSTOMER_SESSION_COOKIE_NAME, CustomerAuthService } from "./customer-auth.service";

@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(private readonly auth: CustomerAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<{ setHeader: (name: string, value: string) => void }>();
    response.setHeader("Cache-Control", "private, no-store");
    const token = (request.cookies as Record<string, string> | undefined)?.[CUSTOMER_SESSION_COOKIE_NAME];
    if (!token) throw new UnauthorizedException("Customer authentication required");
    const resolved = await this.auth.resolveSession(token);
    if (!resolved) throw new UnauthorizedException("Customer session expired or invalid");
    request.customer = resolved.customer;
    request.customerSession = resolved.session;
    return true;
  }
}
