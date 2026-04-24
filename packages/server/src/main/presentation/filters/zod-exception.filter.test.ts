import type { ArgumentsHost } from "@nestjs/common";
import { HttpException, HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GlobalExceptionFilter } from "./zod-exception.filter.js";

function createHttpHost() {
    const response = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
    };
    const host = {
        switchToHttp: () => ({
            getResponse: () => response,
            getRequest: () => ({ url: "/test" }),
        }),
    } as unknown as ArgumentsHost;

    return { host, response };
}

describe("GlobalExceptionFilter", () => {
    it("normalizes explicit HttpException responses", () => {
        const { host, response } = createHttpHost();

        new GlobalExceptionFilter().catch(
            new HttpException({ error: "Task not found" }, HttpStatus.NOT_FOUND),
            host,
        );

        expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
        expect(response.json).toHaveBeenCalledWith({
            ok: false,
            error: {
                code: "not_found",
                message: "Task not found",
            },
        });
    });

    it("normalizes ZodError responses as validation failures", () => {
        const { host, response } = createHttpHost();
        const parseResult = z.object({ name: z.string() }).safeParse({});
        if (parseResult.success) throw new Error("expected schema parse to fail");

        new GlobalExceptionFilter().catch(parseResult.error, host);

        expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(response.json).toHaveBeenCalledWith({
            ok: false,
            error: expect.objectContaining({
                code: "validation_error",
                message: "Invalid request",
                details: expect.any(Object),
            }),
        });
    });

    it("does not expose unknown server error messages", () => {
        const { host, response } = createHttpHost();

        new GlobalExceptionFilter().catch(new Error("sqlite path /private/db failed"), host);

        expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(response.json).toHaveBeenCalledWith({
            ok: false,
            error: {
                code: "internal_server_error",
                message: "Internal server error",
            },
        });
    });

    it("preserves non-500 error-like messages", () => {
        const { host, response } = createHttpHost();

        new GlobalExceptionFilter().catch({ statusCode: HttpStatus.CONFLICT, message: "version mismatch" }, host);

        expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
        expect(response.json).toHaveBeenCalledWith({
            ok: false,
            error: {
                code: "conflict",
                message: "version mismatch",
            },
        });
    });
});
