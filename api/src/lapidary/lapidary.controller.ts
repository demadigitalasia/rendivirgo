import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { createReadStream } from "node:fs";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CustomerGuard } from "../customers/customer.guard";
import { CUSTOMER_SESSION_COOKIE_NAME, CustomerAuthService } from "../customers/customer-auth.service";
import {
  AcceptLapidaryEstimateDto,
  ConfirmLapidaryPaymentDto,
  ClaimLapidaryRequestDto,
  CreateLapidaryProgressUpdateDto,
  CreateLapidaryRequestDto,
  LapidaryRequestQueryDto,
  SaveLapidaryArtistsPresentationDto,
  SaveLapidaryArtistDto,
  SaveLapidaryProcessDto,
  SaveLapidaryStudioDto,
  SaveLapidaryDomeDto,
  SaveLapidaryServicePricingDto,
  SubmitLapidaryInboundShipmentDto,
  UpdateLapidaryRequestDto,
} from "./lapidary.dto";
import { LapidaryService } from "./lapidary.service";

@Controller("lapidary")
export class LapidaryPublicController {
  constructor(private readonly lapidary: LapidaryService, private readonly customerAuth: CustomerAuthService) {}

  @Public()
  @Get("content")
  content(@Headers("x-rv-language") language?: string) {
    return this.lapidary.publicContent(language === "id" ? "id" : "en");
  }

  @Public()
  @Get("service-pricing")
  servicePricing() {
    return this.lapidary.servicePricing();
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("requests")
  @UseInterceptors(FilesInterceptor("media", 5, {
    limits: { fileSize: 6 * 1024 * 1024, files: 5, fields: 1, fieldSize: 100 * 1024, parts: 6 },
    fileFilter: (_request, file, callback) => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4"];
      if (!allowed.includes(file.mimetype)) {
        callback(new BadRequestException("Use JPEG, PNG, WebP, AVIF, or MP4 files"), false);
        return;
      }
      callback(null, true);
    },
  }))
  async createRequest(
    @Body() body: unknown,
    @UploadedFiles() files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>,
    @Req() request: AuthenticatedRequest,
  ) {
    const rawPayload = body && typeof body === "object" && "payload" in body ? (body as { payload: unknown }).payload : body;
    let payload: unknown = rawPayload;
    if (typeof rawPayload === "string") {
      if (rawPayload.length > 100_000) throw new BadRequestException("The request details are too large");
      try { payload = JSON.parse(rawPayload); } catch { throw new BadRequestException("The request details are not valid JSON"); }
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new BadRequestException("The request details are missing");
    const dto = plainToInstance(CreateLapidaryRequestDto, payload, { enableImplicitConversion: true });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
      const messages: string[] = [];
      const collect = (items: typeof errors) => items.forEach((error) => {
        messages.push(...Object.values(error.constraints ?? {}));
        collect(error.children ?? []);
      });
      collect(errors);
      throw new BadRequestException(messages.length ? messages : "Please review the request details");
    }
    const sessionToken = (request.cookies as Record<string, string> | undefined)?.[CUSTOMER_SESSION_COOKIE_NAME];
    const session = sessionToken ? await this.customerAuth.resolveSession(sessionToken) : null;
    const customerId = session && session.customer.email.trim().toLowerCase() === dto.email.trim().toLowerCase()
      ? session.customer.id
      : null;
    return this.lapidary.createRequest(dto, files ?? [], customerId);
  }
}

@Controller("admin/lapidary/requests")
export class AdminLapidaryRequestsController {
  constructor(private readonly lapidary: LapidaryService) {}

  @Get("readiness")
  readiness() {
    return this.lapidary.readiness();
  }

  @Get()
  list(@Query() query: LapidaryRequestQueryDto) {
    return this.lapidary.listRequests(query);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.lapidary.getRequest(id);
  }

  @Get(":id/media/:mediaId")
  async media(@Param("id") id: string, @Param("mediaId") mediaId: string, @Res() response: Response) {
    const media = await this.lapidary.getRequestMedia(id, mediaId);
    const filename = media.originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "lapidary-reference";
    response.setHeader("Content-Type", media.mimeType);
    response.setHeader("Content-Length", String(media.size));
    response.setHeader("Content-Disposition", `inline; filename=\"${filename}\"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    createReadStream(media.path).on("error", () => response.destroy()).pipe(response);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateLapidaryRequestDto, @Req() request: AuthenticatedRequest) {
    return this.lapidary.updateRequest(id, dto, auditContextFrom(request));
  }

  @Post(":id/updates")
  @UseInterceptors(FilesInterceptor("media", 5, {
    limits: { fileSize: 6 * 1024 * 1024, files: 5, fields: 3, fieldSize: 4_000, parts: 8 },
    fileFilter: (_request, file, callback) => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
      if (!allowed.includes(file.mimetype)) {
        callback(new BadRequestException("Use JPEG, PNG, WebP, or AVIF photos"), false);
        return;
      }
      callback(null, true);
    },
  }))
  async addProgressUpdate(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>,
    @Req() request: AuthenticatedRequest,
  ) {
    const dto = plainToInstance(CreateLapidaryProgressUpdateDto, body, { enableImplicitConversion: true });
    dto.isCustomerVisible = body.isCustomerVisible === undefined || body.isCustomerVisible === "true" || body.isCustomerVisible === true;
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) throw new BadRequestException(errors.flatMap((error) => Object.values(error.constraints ?? {})));
    return this.lapidary.addProgressUpdate(id, dto, files ?? [], request.admin?.id);
  }

  @Get(":id/updates/:updateId/media/:mediaId")
  async progressMedia(@Param("id") id: string, @Param("updateId") updateId: string, @Param("mediaId") mediaId: string, @Res() response: Response) {
    const media = await this.lapidary.getProgressMediaForAdmin(id, updateId, mediaId);
    response.setHeader("Content-Type", media.mimeType);
    response.setHeader("Content-Length", String(media.size));
    response.setHeader("Content-Disposition", `inline; filename="${media.originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "lapidary-progress"}"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    createReadStream(media.path).on("error", () => response.destroy()).pipe(response);
  }

  @Get(":id/invoice/payment-proof")
  async invoicePaymentProof(@Param("id") id: string, @Res() response: Response) {
    const proof = await this.lapidary.getInvoicePaymentProof(id);
    response.setHeader("Content-Type", proof.mimeType);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    createReadStream(proof.path).on("error", () => response.destroy()).pipe(response);
  }

  @Patch(":id/invoice/paid")
  markInvoicePaid(@Param("id") id: string, @Body() dto: ConfirmLapidaryPaymentDto, @Req() request: AuthenticatedRequest) {
    return this.lapidary.markInvoicePaid(id, auditContextFrom(request), dto);
  }

  @Post(":id/invitation")
  reissueInvitation(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.lapidary.reissueInvitation(id, auditContextFrom(request));
  }

  @Post(":id/email/retry")
  retryEmail(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.lapidary.retryCustomerEmails(id, auditContextFrom(request));
  }
}

@Public()
@UseGuards(CustomerGuard)
@Controller("customer-account/lapidary")
export class CustomerLapidaryController {
  constructor(private readonly lapidary: LapidaryService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.lapidary.listCustomerRequests(request.customer!.id);
  }

  @Post("claim")
  claim(@Req() request: AuthenticatedRequest, @Body() dto: ClaimLapidaryRequestDto) {
    return this.lapidary.claimCustomerRequest(request.customer!.id, dto);
  }

  @Get(":requestNumber")
  detail(@Req() request: AuthenticatedRequest, @Param("requestNumber") requestNumber: string) {
    return this.lapidary.getCustomerRequest(request.customer!.id, requestNumber);
  }

  @Post(":requestNumber/accept-estimate")
  acceptEstimate(@Req() request: AuthenticatedRequest, @Param("requestNumber") requestNumber: string, @Body() dto: AcceptLapidaryEstimateDto) {
    return this.lapidary.acceptEstimate(request.customer!.id, requestNumber, dto);
  }

  @Post(":requestNumber/inbound-shipment")
  submitInboundShipment(@Req() request: AuthenticatedRequest, @Param("requestNumber") requestNumber: string, @Body() dto: SubmitLapidaryInboundShipmentDto) {
    return this.lapidary.submitInboundShipment(request.customer!.id, requestNumber, dto);
  }

  @Post(":requestNumber/invoice/payment-proof")
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
      if (!allowed.includes(file.mimetype)) {
        callback(new BadRequestException("Upload a JPEG, PNG, WebP, or AVIF bank transfer receipt"), false);
        return;
      }
      callback(null, true);
    },
  }))
  uploadPaymentProof(
    @Req() request: AuthenticatedRequest,
    @Param("requestNumber") requestNumber: string,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    @Body("revision") revision: string,
  ) {
    if (!/^[1-9]\d*$/.test(revision ?? "")) throw new BadRequestException("Refresh the invoice before uploading a receipt");
    return this.lapidary.uploadInvoicePaymentProof(request.customer!.id, requestNumber, file, Number(revision));
  }

  @Get(":requestNumber/updates/:updateId/media/:mediaId")
  async progressMedia(
    @Req() request: AuthenticatedRequest,
    @Param("requestNumber") requestNumber: string,
    @Param("updateId") updateId: string,
    @Param("mediaId") mediaId: string,
    @Res() response: Response,
  ) {
    const media = await this.lapidary.getProgressMediaForCustomer(request.customer!.id, requestNumber, updateId, mediaId);
    response.setHeader("Content-Type", media.mimeType);
    response.setHeader("Content-Length", String(media.size));
    response.setHeader("Content-Disposition", `inline; filename="${media.originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "lapidary-progress"}"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    createReadStream(media.path).on("error", () => response.destroy()).pipe(response);
  }
}

@Controller("admin/lapidary/content")
export class AdminLapidaryContentController {
  constructor(private readonly lapidary: LapidaryService) {}

  @Get()
  content() {
    return this.lapidary.adminContent();
  }

  @Patch("dome")
  saveDome(@Body() dto: SaveLapidaryDomeDto, @Req() request: AuthenticatedRequest) {
    return this.lapidary.saveDome(dto, auditContextFrom(request));
  }

  @Patch("service-pricing")
  saveServicePricing(@Body() dto: SaveLapidaryServicePricingDto, @Req() request: AuthenticatedRequest) {
    return this.lapidary.saveServicePricing(dto, auditContextFrom(request));
  }

  @Get("service-pricing")
  servicePricing() {
    return this.lapidary.servicePricing();
  }

  @Patch("studio")
  saveStudio(@Body() dto: SaveLapidaryStudioDto, @Req() request: AuthenticatedRequest) {
    return this.lapidary.saveStudio(dto, auditContextFrom(request));
  }

  @Patch("process")
  saveProcess(@Body() dto: SaveLapidaryProcessDto, @Req() request: AuthenticatedRequest) {
    return this.lapidary.saveProcess(dto, auditContextFrom(request));
  }

  @Patch("artists/presentation")
  saveArtistsPresentation(@Body() dto: SaveLapidaryArtistsPresentationDto, @Req() request: AuthenticatedRequest) {
    return this.lapidary.saveArtistsPresentation(dto, auditContextFrom(request));
  }

  @Post("artists")
  createArtist(@Body() dto: SaveLapidaryArtistDto, @Req() request: AuthenticatedRequest) {
    return this.lapidary.saveArtist(null, dto, auditContextFrom(request));
  }

  @Patch("artists/:id")
  updateArtist(@Param("id") id: string, @Body() dto: SaveLapidaryArtistDto, @Req() request: AuthenticatedRequest) {
    return this.lapidary.saveArtist(id, dto, auditContextFrom(request));
  }

  @Delete("artists/:id")
  deleteArtist(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.lapidary.deleteArtist(id, auditContextFrom(request));
  }
}
