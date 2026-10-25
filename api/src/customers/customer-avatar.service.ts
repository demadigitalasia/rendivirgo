import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join, relative, resolve, sep } from "node:path";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import { prepareCustomerAvatar } from "./customer-avatar-image";

type CustomerAvatarUpload = { buffer: Buffer; mimetype: string };

@Injectable()
export class CustomerAvatarService {
  private readonly uploadDir: string;
  private readonly publicApiUrl: string;

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, config: ConfigService) {
    this.uploadDir = resolve(join(process.cwd(), config.get<string>("UPLOAD_DIR") ?? "uploads"));
    this.publicApiUrl = (config.get<string>("PUBLIC_API_URL") ?? "http://localhost:4000").replace(/\/+$/, "");
  }

  async update(customerId: string, file: CustomerAvatarUpload | undefined, context: AuditContext): Promise<string> {
    if (!file) throw new BadRequestException("Choose a profile photo to upload.");
    const prepared = prepareCustomerAvatar(file.buffer, file.mimetype);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, avatarUrl: true } });
    if (!customer) throw new NotFoundException("Customer account not found.");

    const monthFolder = new Date().toISOString().slice(0, 7).replace("-", "");
    const customerFolder = join(this.uploadDir, "customer-avatars", monthFolder);
    await mkdir(customerFolder, { recursive: true });
    const filename = `${randomBytes(16).toString("hex")}${prepared.extension}`;
    const destination = join(customerFolder, filename);
    await writeFile(destination, prepared.buffer, { flag: "wx" });
    const relativePath = relative(this.uploadDir, destination).split(sep).join("/");
    const avatarUrl = `${this.publicApiUrl}/uploads/${relativePath}`;

    try {
      await this.prisma.customer.update({ where: { id: customerId }, data: { avatarUrl } });
    } catch (error) {
      await unlink(destination).catch(() => undefined);
      throw error;
    }

    if (customer.avatarUrl && customer.avatarUrl !== avatarUrl) await this.removeManagedFile(customer.avatarUrl);
    await this.audit.log({
      action: "customer.profile.avatar_updated",
      entityType: "Customer",
      entityId: customerId,
      summary: "Customer profile photo updated",
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return avatarUrl;
  }

  async remove(customerId: string, context: AuditContext): Promise<void> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, avatarUrl: true } });
    if (!customer) throw new NotFoundException("Customer account not found.");
    if (!customer.avatarUrl) return;

    await this.prisma.customer.update({ where: { id: customerId }, data: { avatarUrl: null } });
    await this.removeManagedFile(customer.avatarUrl);
    await this.audit.log({
      action: "customer.profile.avatar_removed",
      entityType: "Customer",
      entityId: customerId,
      summary: "Customer profile photo removed",
      ip: context.ip,
      userAgent: context.userAgent,
    });
  }

  private async removeManagedFile(url: string): Promise<void> {
    const prefix = `${this.publicApiUrl}/uploads/customer-avatars/`;
    if (!url.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    if (!/^\d{6}\/[a-f0-9]{32}\.(?:jpg|png)$/.test(key)) return;
    const root = resolve(this.uploadDir, "customer-avatars");
    const target = resolve(root, ...key.split("/"));
    if (!target.startsWith(`${root}${sep}`)) return;
    await unlink(target).catch(() => undefined);
  }
}
