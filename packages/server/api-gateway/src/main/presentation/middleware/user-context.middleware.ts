import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { DEFAULT_USER_ID, runWithUser } from "@monitor/shared/kernel/user/user.context.js";
import { deriveUserId } from "@monitor/shared/kernel/user/user.identity.js";

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
    use(request: Request, _response: Response, next: NextFunction): void {
        runWithUser(resolveUserId(request), () => next());
    }
}

function resolveUserId(request: Request): string {
    const explicit = headerValue(request, "x-user-id");
    if (explicit) return explicit;
    const email = headerValue(request, "x-user-email");
    if (email) return deriveUserId(email);
    return DEFAULT_USER_ID;
}

function headerValue(request: Request, name: string): string | undefined {
    const raw = request.headers[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}
