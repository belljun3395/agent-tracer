import type { ExceptionFilter, ArgumentsHost } from "@nestjs/common";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import { ZodError } from "zod";
import type { Response } from "express";

const INTERNAL_SERVER_ERROR_BODY = { error: "Internal server error" } as const;

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const body = exception.getResponse();
            response.status(status).json(body);
            return;
        }
        if (exception instanceof ZodError) {
            response.status(HttpStatus.BAD_REQUEST).json({
                ok: false,
                error: {
                    code: "validation_error",
                    message: "Invalid request",
                    details: exception.format(),
                },
            });
            return;
        }
        const status = getStatusFromError(exception);
        if (status >= 500) {
            response.status(status).json(INTERNAL_SERVER_ERROR_BODY);
            return;
        }
        response.status(status).json({ error: getMessageFromError(exception) });
    }
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
