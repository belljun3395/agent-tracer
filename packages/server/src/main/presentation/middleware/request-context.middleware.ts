import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import {
    assignRequestContext,
    createHttpRequestContext,
    logHttpAccess,
    REQUEST_ID_HEADER,
    type RequestContextIncomingMessage,
} from "./request-context.js";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
    use(request: Request, response: Response, next: NextFunction): void {
        const context = createHttpRequestContext(request);
        const startedAt = process.hrtime.bigint();

        assignRequestContext(request as RequestContextIncomingMessage, context);
        response.setHeader(REQUEST_ID_HEADER, context.requestId);

        response.on("finish", () => {
            const userAgent = request.get("user-agent");
            logHttpAccess({
                type: "http_access",
                requestId: context.requestId,
                method: request.method,
                path: request.originalUrl || request.url,
                statusCode: response.statusCode,
                durationMs: durationMs(startedAt),
                clientIp: context.clientIp,
                ...(userAgent ? { userAgent } : {}),
            });
        });

        next();
    }
}

function durationMs(startedAt: bigint): number {
    return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}
