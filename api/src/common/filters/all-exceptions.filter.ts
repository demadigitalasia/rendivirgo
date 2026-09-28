import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { Prisma } from "../../../generated/prisma";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpException");

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    let status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    let errorName = exception instanceof HttpException ? exception.name : "InternalServerError";
    let message: string | string[] = "Internal server error";

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === "string") {
        message = payload;
      } else if (payload && typeof payload === "object") {
        const body = payload as { message?: string | string[]; error?: string };
        message = body.message ?? body.error ?? message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      errorName = "PrismaError";
      switch (exception.code) {
        case "P2002": {
          const target = exception.meta?.target;
          const fields = Array.isArray(target) ? target.join(", ") : typeof target === "string" ? target : "";
          status = HttpStatus.CONFLICT;
          message = fields
            ? `A record with this ${fields} already exists`
            : "A record with these values already exists";
          break;
        }
        case "P2025":
          status = HttpStatus.NOT_FOUND;
          message = "The requested record was not found";
          break;
        case "P2003":
          status = HttpStatus.CONFLICT;
          message = "This operation conflicts with related records";
          break;
        case "P2014":
          status = HttpStatus.CONFLICT;
          message = "This change would break a required relation";
          break;
        default:
          break;
      }
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      statusCode: status,
      error: errorName,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
