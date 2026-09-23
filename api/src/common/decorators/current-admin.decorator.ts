import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedAdmin, AuthenticatedRequest } from "../types/authenticated-request";

export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedAdmin | undefined => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.admin;
});
