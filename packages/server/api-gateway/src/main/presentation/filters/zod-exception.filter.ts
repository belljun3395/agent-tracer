import type { ExceptionFilter, ArgumentsHost } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ZodError } from "zod";
import type { Response } from "express";
import { DomainError } from "@monitor/shared/kernel/domain.error.js";
import { createApiErrorEnvelope, isApiErrorEnvelope } from "@monitor/shared/contracts/http/api-response-envelope.js";

const INTERNAL_SERVER_ERROR_BODY = createApiErrorEnvelope("internal_server_error", "Internal server error");
const STATUS_ERROR_CODES = new Map<number, string>([
    [HttpStatus.BAD_REQUEST, "bad_request"],
    [HttpStatus.UNAUTHORIZED, "unauthorized"],
    [HttpStatus.FORBIDDEN, "forbidden"],
    [HttpStatus.NOT_FOUND, "not_found"],
    [HttpStatus.CONFLICT, "conflict"],
    [HttpStatus.UNPROCESSABLE_ENTITY, "unprocessable_entity"],
]);

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter<unknown> {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        if (exception instanceof HttpException) {
            // Nest 예외는 기존 status를 유지하되 응답 본문만 공통 API 포맷으로 맞춘다.
            const status = exception.getStatus();
            const body = exception.getResponse();
            response.status(status).json(normalizeHttpExceptionBody(status, body));
            return;
        }

        if (exception instanceof DomainError) {
            // 도메인 예외는 각 예외가 선언한 HTTP status와 code를 그대로 노출한다.
            response.status(exception.httpStatus).json(
                createApiErrorEnvelope(exception.code, exception.message, exception.details),
            );
            return;
        }

        if (exception instanceof ZodError) {
            // Zod 검증 실패는 클라이언트 입력 문제로 고정해 400을 반환한다.
            response.status(HttpStatus.BAD_REQUEST).json(
                createApiErrorEnvelope("validation_error", "Invalid request", exception.format()),
            );
            return;
        }

        const status = getStatusFromError(exception);
        if (status >= 500) {
            // 서버 오류는 내부 메시지를 숨기고 로그에만 상세를 남긴다.
            this.logger.error(
                `Unhandled exception (${status})`,
                exception instanceof Error ? exception.stack : String(exception),
            );
            response.status(status).json(INTERNAL_SERVER_ERROR_BODY);
            return;
        }
        response.status(status).json(
            createApiErrorEnvelope(statusToErrorCode(status), getMessageFromError(exception)),
        );
    }
}

function normalizeHttpExceptionBody(status: number, body: string | object): unknown {
    // 이미 공통 포맷이면 중복 포장을 하지 않는다.
    if (isApiErrorEnvelope(body)) return body;

    const message = getMessageFromHttpExceptionBody(body);
    const details = getDetailsFromHttpExceptionBody(body);
    return createApiErrorEnvelope(statusToErrorCode(status), message, details);
}

function getStatusFromError(error: unknown): number {
    if (typeof error === "object" && error !== null) {
        const candidate = (error as {
            status?: unknown;
            statusCode?: unknown;
        }).statusCode
            ?? (error as {
                status?: unknown;
                statusCode?: unknown;
            }).status;
        // 외부 예외가 유효한 HTTP status를 갖고 있으면 그 값을 따른다.
        if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 400 && candidate < 600) {
            return candidate;
        }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
}

function getMessageFromError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null) {
        const candidate = (error as { message?: unknown }).message;
        if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
    return "Request failed";
}

function getMessageFromHttpExceptionBody(body: string | object): string {
    if (typeof body === "string") return body;
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message) && message.every((item) => typeof item === "string")) {
        return message.join("; ");
    }

    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;

    return "Request failed";
}

function getDetailsFromHttpExceptionBody(body: string | object): unknown {
    if (typeof body !== "object" || Array.isArray(body)) return undefined;
    const details = (body as { details?: unknown }).details;
    if (details !== undefined) return details;

    const message = (body as { message?: unknown }).message;
    return Array.isArray(message) ? message : undefined;
}

function statusToErrorCode(status: number): string {
    return STATUS_ERROR_CODES.get(status) ?? (status >= 500 ? "internal_server_error" : "request_failed");
}
