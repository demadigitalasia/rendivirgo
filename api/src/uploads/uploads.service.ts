import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, unlink } from "node:fs/promises";
import { join, basename, relative, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { ALLOWED_IMAGE_MIME, detectImageType, type DetectedImage } from "./image-validation";

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
    this.uploadDir = resolve(join(process.cwd(), config.get<string>("UPLOAD_DIR") ?? "uploads"));
    this.publicUrl = (config.get<string>("PUBLIC_API_URL") ?? "http://localhost:4000").replace(/\/$/, "");
  }

  resolveFolder(folder: string | undefined): string {
    const value = (folder ?? "misc").toLowerCase();
    if (!ALLOWED_FOLDERS.has(value)) throw new BadRequestException(`Folder must be one of: ${[...ALLOWED_FOLDERS].join(", ")}`);
    return value;
  }

  // Validates the declared MIME against the real file signature and derives the
  // canonical extension from the detected type. SVG (and anything else that can
  // execute on page load) never passes this check.
  validateImage(file: UploadedImageFile | undefined): DetectedImage {
    if (!file) throw new BadRequestException("No file uploaded");
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      throw new BadRequestException("Only jpeg, png, webp, gif, or avif images are allowed");
    }

    const detected = detectImageType(file.buffer);
    if (!detected) throw new BadRequestException("The uploaded file is not a valid image");

    if (detected.mime !== file.mimetype) {
      throw new BadRequestException("The file content does not match its declared type");
    }

    return detected;
  }

  validateRegisteredFile(file: UploadedFileInfo): void {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype) && file.mimetype !== "video/mp4") {
      throw new BadRequestException("Only supported images and MP4 videos are allowed");
    }
  }

  validateVideo(file: UploadedImageFile | undefined): void {
    if (!file) throw new BadRequestException("No video uploaded");
    if (file.mimetype !== "video/mp4") throw new BadRequestException("Only MP4 videos are allowed");
    if (file.buffer.length < 12 || file.buffer.subarray(4, 8).toString("ascii") !== "ftyp") {
      throw new BadRequestException("The file is not a valid MP4 video");
    }
  }

  storageFolder(folder: string): string {
    const now = new Date();
    return join(this.uploadDir, folder, `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`);
  }

  staticFilename(extension: string): string {
    const safeExtension = /^\.[a-z0-9]{2,5}$/.test(extension) ? extension : ".bin";
    return `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}${safeExtension}`;
  }

  async ensureStorage(folder: string) {
    await mkdir(this.storageFolder(folder), { recursive: true });
  }

  async register(file: UploadedFileInfo, folder: string, context: AuditContext) {
    this.validateRegisteredFile(file);
    const relativePath = relative(this.uploadDir, file.path).split("\\").join("/");
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

    const [productImages, productVideos, categories, blogPosts, banners, orderItems, admins, siteSettings] = await Promise.all([
      this.prisma.productImage.count({ where: { url: asset.url } }),
      this.prisma.product.count({ where: { videoUrl: asset.url } }),
      this.prisma.category.count({ where: { imageUrl: asset.url } }),
      this.prisma.blogPost.count({ where: { coverImage: asset.url } }),
      this.prisma.banner.count({ where: { imageUrl: asset.url } }),
      this.prisma.orderItem.count({ where: { imageUrl: asset.url } }),
      this.prisma.admin.count({ where: { avatarUrl: asset.url } }),
      this.prisma.siteSetting.findMany({
        where: { key: { in: ["home.heroImage", "home.ownerImage", "store.productWatermarkLogo"] } },
        select: { key: true, value: true },
      }),
    ]);

    const siteContent = siteSettings.filter((setting) => setting.value === asset.url).map((setting) => setting.key);
    const references = [
      productImages ? `${productImages} product image(s)` : null,
      productVideos ? `${productVideos} product video(s)` : null,
      categories ? `${categories} category image(s)` : null,
      blogPosts ? `${blogPosts} blog cover image(s)` : null,
      banners ? `${banners} banner image(s)` : null,
      orderItems ? `${orderItems} order image snapshot(s)` : null,
      admins ? `${admins} admin avatar(s)` : null,
      ...siteContent,
    ].filter((reference): reference is string => reference !== null);

    if (references.length) {
      throw new BadRequestException(
        `Cannot delete this media because it is still used by ${references.join(", ")}. Remove those references first.`,
      );
    }

    const relativePath = asset.url.split("/uploads/")[1];
    if (relativePath) {
      const target = resolve(this.uploadDir, relativePath);
      if (target === this.uploadDir || !target.startsWith(this.uploadDir + sep)) {
        throw new BadRequestException("Invalid media path");
      }
      try {
        await unlink(target);
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
