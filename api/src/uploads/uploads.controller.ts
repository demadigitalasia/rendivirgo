import { BadRequestException, Controller, Delete, Get, Param, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { UploadsService, type UploadedImageFile } from "./uploads.service";

@Controller("admin/uploads")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get()
  list(@Query("folder") folder?: string) {
    return this.uploadsService.list(folder);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
        if (!allowed.includes(file.mimetype)) {
          callback(new BadRequestException("Only image files are allowed"), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: UploadedImageFile | undefined,
    @Query("folder") folder: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    this.uploadsService.validate(
      file ? { originalname: file.originalname, filename: "", mimetype: file.mimetype, size: file.size, path: "" } : undefined,
    );
    const targetFolder = this.uploadsService.resolveFolder(folder);

    await this.uploadsService.ensureStorage(targetFolder);
    const filename = this.uploadsService.staticFilename(file!.originalname);
    const destination = join(this.uploadsService.storageFolder(targetFolder), filename);
    await writeFile(destination, file!.buffer);

    return this.uploadsService.register(
      { originalname: file!.originalname, filename, mimetype: file!.mimetype, size: file!.size, path: destination },
      targetFolder,
      auditContextFrom(request),
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.uploadsService.remove(id, auditContextFrom(request));
  }
}
