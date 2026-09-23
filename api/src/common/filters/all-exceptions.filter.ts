import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpException");

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = "Internal server error";
    if (typeof payload === "string") {
      message = payload;
    } else if (payload && typeof payload === "object") {
      const body = payload as { message?: string | string[]; error?: string };
      message = body.message ?? body.error ?? message;
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      statusCode: status,
      error: exception instanceof HttpException ? exception.name : "InternalServerError",
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
