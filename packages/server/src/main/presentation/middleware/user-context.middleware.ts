import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { DEFAULT_USER_ID, runWithUser } from "~shared/user/user.context.js";
import { deriveUserId } from "~shared/user/user.identity.js";

/**
 * 요청에서 사용자를 식별해 ALS 범위로 나머지 처리를 감싼다. `X-User-Id` 가 있으면
 * 그대로, 없고 `X-User-Email` 이 있으면 deriveUserId 로 변환, 둘 다 없으면 기본 사용자.
 */
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
