import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { OrderReturnRequestStatus } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import { ALLOWED_IMAGE_MIME, detectImageType } from "../uploads/image-validation";
import type { CreateReturnRequestDto, ReviewReturnRequestDto } from "./dto/order.dto";

export type ReturnEvidenceFile = { originalname: string; mimetype: string; buffer: Buffer };

@Injectable()
export class OrderReturnRequestsService {
  private readonly uploadRoot: string;
  private readonly privateRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.uploadRoot = resolve(join(process.cwd(), config.get<string>("UPLOAD_DIR") ?? "uploads"));
    this.privateRoot = resolve(this.uploadRoot, ".private", "returns");
  }

  async submit(input: CreateReturnRequestDto, file: ReturnEvidenceFile | undefined) {
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber: input.orderNumber.trim().toUpperCase(),
        email: input.email.trim().toLowerCase(),
      },
      select: { id: true, orderNumber: true, status: true, paidAt: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (!order.paidAt || (order.status !== "Shipped" && order.status !== "Completed")) {
      throw new BadRequestException("A return request can be submitted after a paid order has shipped");
    }

    let evidencePath: string | null = null;
    let evidenceMime: string | null = null;
    if (file) {
      if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) throw new BadRequestException("Upload a JPEG, PNG, WebP, GIF, or AVIF image");
      const detected = detectImageType(file.buffer);
      if (!detected || detected.mime !== file.mimetype) throw new BadRequestException("The uploaded file is not a valid image");
      const month = new Date().toISOString().slice(0, 7).replace("-", "");
      const folder = join(this.privateRoot, month);
      await mkdir(folder, { recursive: true });
      const filename = `${Date.now().toString(36)}-${randomBytes(10).toString("hex")}${detected.extension}`;
      const absolutePath = join(folder, filename);
      await writeFile(absolutePath, file.buffer, { flag: "wx" });
      evidencePath = relative(this.uploadRoot, absolutePath).split(sep).join("/");
      evidenceMime = detected.mime;
    }

    try {
      const request = await this.prisma.$transaction(async (tx) => {
        const created = await tx.orderReturnRequest.create({
          data: {
            orderId: order.id,
            reason: input.reason,
            details: input.details.trim(),
            evidencePath,
            evidenceMime,
          },
        });
        await tx.notification.create({
          data: {
            type: "Order",
            title: `Return request for ${order.orderNumber}`,
            body: `A customer submitted a ${input.reason} return request.`,
            href: `/admin/orders/${order.id}`,
            entityType: "OrderReturnRequest",
            entityId: created.id,
          },
        });
        return created;
      });
      return this.toApi(request);
    } catch (error) {
      if (evidencePath) await unlink(resolve(this.uploadRoot, evidencePath)).catch(() => undefined);
      throw error;
    }
  }

  async review(orderId: string, requestId: string, input: ReviewReturnRequestDto, context: AuditContext) {
    const existing = await this.prisma.orderReturnRequest.findFirst({ where: { id: requestId, orderId } });
    if (!existing) throw new NotFoundException("Return request not found");
    if (existing.status !== OrderReturnRequestStatus.Pending) {
      throw new ConflictException("This return request has already been reviewed");
    }
    const reviewedAt = new Date();
    const changed = await this.prisma.orderReturnRequest.updateMany({
      where: { id: requestId, orderId, status: OrderReturnRequestStatus.Pending },
      data: {
        status: input.status,
        adminResponse: input.adminResponse?.trim() || null,
        reviewedById: context.adminId,
        reviewedAt,
      },
    });
    if (changed.count !== 1) throw new ConflictException("This return request changed while it was being reviewed");
    const request = await this.prisma.orderReturnRequest.findUniqueOrThrow({ where: { id: requestId } });
    await this.audit.log({
      adminId: context.adminId,
      action: "order.return_request.review",
      entityType: "OrderReturnRequest",
      entityId: request.id,
      summary: `${input.status} return request for order ${orderId}`,
      metadata: { status: input.status, adminResponse: input.adminResponse?.trim() || null },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return this.toApi(request);
  }

  async readEvidence(orderId: string, requestId: string) {
    const request = await this.prisma.orderReturnRequest.findFirst({
      where: { id: requestId, orderId },
      select: { evidencePath: true, evidenceMime: true },
    });
    if (!request?.evidencePath || !request.evidenceMime) throw new NotFoundException("Evidence image not found");
    const absolutePath = resolve(this.uploadRoot, request.evidencePath);
    if (!absolutePath.startsWith(this.privateRoot + sep)) throw new BadRequestException("Invalid evidence path");
    return { buffer: await readFile(absolutePath), mimeType: request.evidenceMime, filename: basename(absolutePath) };
  }

  private toApi(request: {
    id: string;
    orderId: string;
    status: OrderReturnRequestStatus;
    reason: string;
    details: string;
    evidencePath: string | null;
    submittedAt: Date;
    reviewedAt: Date | null;
    adminResponse: string | null;
    reviewedById: string | null;
  }) {
    return {
      id: request.id,
      orderId: request.orderId,
      status: request.status,
      reason: request.reason,
      details: request.details,
      hasEvidence: Boolean(request.evidencePath),
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      adminResponse: request.adminResponse,
      reviewedById: request.reviewedById,
    };
  }
}
