import type { AuthenticatedRequest } from "../types/authenticated-request";
import type { AuditContext } from "../types/audit-context";

export function auditContextFrom(request: AuthenticatedRequest): AuditContext {
  return {
    adminId: request.admin?.id ?? null,
    ip: request.ip ?? null,
    userAgent: (request.headers["user-agent"] as string | undefined) ?? null,
  };
}
