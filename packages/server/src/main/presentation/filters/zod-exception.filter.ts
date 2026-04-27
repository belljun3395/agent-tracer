import type { ExceptionFilter, ArgumentsHost } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ZodError } from "zod";
import type { Response } from "express";
import { TaskNotFoundError, TurnPartitionVersionMismatchError } from "~turn-partition/common/turn.partition.errors.js";
import { InvalidRuleError, RuleNotFoundError } from "~rule/common/errors.js";
import { createApiErrorEnvelope, isApiErrorEnvelope } from "~adapters/http/shared/api-response-envelope.js";

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
            const status = exception.getStatus();
            const body = exception.getResponse();
            response.status(status).json(normalizeHttpExceptionBody(status, body));
            return;
        }

        if (exception instanceof TaskNotFoundError) {
            response.status(HttpStatus.NOT_FOUND).json(
                createApiErrorEnvelope("not_found", exception.message),
            );
            return;
        }

        if (exception instanceof TurnPartitionVersionMismatchError) {
            response.status(HttpStatus.CONFLICT).json(
                createApiErrorEnvelope("conflict", exception.message, {
                    expected: exception.expected,
                    actual: exception.actual,
                }),
            );
            return;
        }

        if (exception instanceof RuleNotFoundError) {
            response.status(HttpStatus.NOT_FOUND).json(
                createApiErrorEnvelope("not_found", exception.message),
            );
            return;
        }

        if (exception instanceof InvalidRuleError) {
            response.status(HttpStatus.BAD_REQUEST).json(
                createApiErrorEnvelope("bad_request", exception.message),
            );
            return;
        }

        if (exception instanceof ZodError) {
            response.status(HttpStatus.BAD_REQUEST).json(
                createApiErrorEnvelope("validation_error", "Invalid request", exception.format()),
            );
            return;
        }

        const status = getStatusFromError(exception);
        if (status >= 500) {
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
