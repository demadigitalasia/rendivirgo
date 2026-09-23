import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, unlink } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"]);
const ALLOWED_FOLDERS = new Set(["products", "blog", "banners", "pages", "brand", "misc"]);

export type UploadedFileInfo = {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
};

export type UploadedImageFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class UploadsService {
  private readonly uploadDir: string;
  private readonly publicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.uploadDir = join(process.cwd(), config.get<string>("UPLOAD_DIR") ?? "uploads");
    this.publicUrl = (config.get<string>("PUBLIC_API_URL") ?? "http://localhost:4000").replace(/\/$/, "");
  }

  resolveFolder(folder: string | undefined): string {
    const value = (folder ?? "misc").toLowerCase();
    if (!ALLOWED_FOLDERS.has(value)) throw new BadRequestException(`Folder must be one of: ${[...ALLOWED_FOLDERS].join(", ")}`);
    return value;
  }

  validate(file: UploadedFileInfo | undefined) {
    if (!file) throw new BadRequestException("No file uploaded");
    if (!ALLOWED_MIME.has(file.mimetype)) throw new BadRequestException("Only image files (jpeg, png, webp, gif, avif, svg) are allowed");
  }

  storageFolder(folder: string): string {
    const now = new Date();
    return join(this.uploadDir, folder, `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`);
  }

  staticFilename(originalName: string): string {
    const extension = extname(originalName).toLowerCase() || ".bin";
    return `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}${extension}`;
  }

  async ensureStorage(folder: string) {
    await mkdir(this.storageFolder(folder), { recursive: true });
  }

  async register(file: UploadedFileInfo, folder: string, context: AuditContext) {
    this.validate(file);
    const relativePath = file.path.replace(this.uploadDir, "").split("\\").join("/").replace(/^\//, "");
    const url = `${this.publicUrl}/uploads/${relativePath}`;

    const asset = await this.prisma.mediaAsset.create({
      data: {
        url,
        filename: basename(file.path),
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        folder,
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "media.upload",
      entityType: "MediaAsset",
      entityId: asset.id,
      summary: `Uploaded ${asset.originalName} to ${folder}`,
      metadata: { size: asset.size, mimeType: asset.mimeType },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return asset;
  }

  async list(folder?: string) {
    return this.prisma.mediaAsset.findMany({
      where: folder ? { folder } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async remove(id: string, context: AuditContext) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException("Media not found");

    const relative = asset.url.split("/uploads/")[1];
    if (relative) {
      try {
        await unlink(join(this.uploadDir, relative));
      } catch {
        // file already removed from disk
      }
    }

    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.audit.log({
      adminId: context.adminId,
      action: "media.delete",
      entityType: "MediaAsset",
      entityId: id,
      summary: `Deleted media ${asset.originalName}`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }
}
