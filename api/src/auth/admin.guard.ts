import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ApiKeysService, API_KEY_PREFIX } from "./api-keys.service";
import { AuthService, SESSION_COOKIE_NAME } from "./auth.service";
import { hasApiKeyScope, scopeDomainForSegments } from "./api-key-scopes";

const SCOPED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE_NAME];
    if (sessionToken) {
      const resolved = await this.authService.resolveSession(sessionToken);
      if (!resolved) {
        throw new UnauthorizedException("Session expired or invalid");
      }
      request.admin = resolved.admin;
      request.adminSession = resolved.session;
      return true;
    }

    const bearer = this.bearerToken(request);
    if (bearer) {
      const resolved = await this.apiKeysService.resolveApiKey(bearer);
      if (!resolved) {
        throw new UnauthorizedException("API key invalid, expired, or revoked");
      }
      request.admin = resolved.admin;
      request.apiKey = resolved.apiKey;
      this.enforceApiKeyScopes(request);
      return true;
    }

    throw new UnauthorizedException("Authentication required");
  }

  private bearerToken(request: AuthenticatedRequest): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token || !token.startsWith(API_KEY_PREFIX)) return null;
    return token;
  }

  private enforceApiKeyScopes(request: AuthenticatedRequest) {
    const segments = (request.originalUrl ?? request.url).split("?")[0].split("/").filter(Boolean);
    // strip the global "api" prefix if present
    if (segments[0] === "api") segments.shift();

    const domain = scopeDomainForSegments(segments);
    if (domain === "self" || domain === null) return;

    // API keys must never manage API keys
    if (segments[0] === "admin" && segments[1] === "api-keys") {
      throw new ForbiddenException("API keys cannot manage API keys");
    }

    const level = SCOPED_METHODS.has(request.method) ? "write" : "read";
    if (!hasApiKeyScope(request.apiKey?.scopes ?? [], domain, level)) {
      throw new ForbiddenException(`API key missing scope: ${domain}:${level}`);
    }
  }
}
