/**
 * @module nestjs/filters/zod-exception.filter
 *
 * 글로벌 예외 필터 — ZodError를 400 응답으로 변환하고
 * 일반 에러를 적절한 HTTP 상태 코드로 매핑한다.
 */
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus
} from "@nestjs/common";
import { ZodError } from "zod";
import type { Response, Request } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    void request;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(body);
      return;
    }

    if (exception instanceof ZodError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        error: exception.message
      });
      return;
    }

    const status = getStatusFromError(exception);
    const message = exception instanceof Error ? exception.message : "Internal server error";
    response.status(status).json({ error: message });
  }
}

function getStatusFromError(error: unknown): number {
  if (typeof error === "object" && error !== null) {
    const candidate = (error as { status?: unknown; statusCode?: unknown }).statusCode
      ?? (error as { status?: unknown; statusCode?: unknown }).status;
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 400 && candidate < 600) {
      return candidate;
    }
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}
