import type { Request } from "express";
import type { Admin, AdminSession } from "../../../generated/prisma";

export type AuthenticatedAdmin = Pick<Admin, "id" | "email" | "name" | "avatarUrl" | "totpEnabled">;

export type AuthenticatedRequest = Request & {
  admin?: AuthenticatedAdmin;
  adminSession?: AdminSession;
};
