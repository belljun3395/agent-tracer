import { ForbiddenException, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { isAuthEnforced, parseCookie, verifyAuthToken } from "@monitor/platform";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { MONITOR_SESSION_COOKIE } from "~tracer-api/support/session.const.js";
import { SKIP_GATE_METADATA_KEY } from "~tracer-api/support/skip-gate.decorator.js";
import { logWarn } from "~tracer-api/config/log.js";
import { routePatternOf } from "~tracer-api/config/http.request.util.js";

/** 데몬은 Bearer 토큰(purpose=api), 웹은 세션 쿠키(purpose=session)로 신원을 검증하고 자기신고 헤더를 검증된 값으로 확정한다. */
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        if (context.getType() !== "http") return true;
        if (this.reflector.getAllAndOverride<boolean | undefined>(SKIP_GATE_METADATA_KEY, [context.getHandler(), context.getClass()])) {
            return true;
        }
        if (!isAuthEnforced()) return true;

        const request = context.switchToHttp().getRequest<Request>();
        const userId = resolvePrincipal(request);
        if (userId === null) {
            logWarn({ msg: "auth.rejected", method: request.method, route: routePatternOf(request) });
            throw new UnauthorizedException("valid bearer token or session required");
        }

        const claimed = headerValue(request.headers[MONITOR_USER_HEADER]);
        if (claimed !== undefined && claimed.trim().length > 0 && claimed.trim() !== userId) {
            logWarn({
                msg: "auth.identityMismatch",
                method: request.method,
                route: routePatternOf(request),
                userId,
                claimedUserId: claimed.trim(),
            });
            throw new ForbiddenException("self-reported user does not match the authenticated identity");
        }
        request.headers[MONITOR_USER_HEADER] = userId;
        return true;
    }
}

function resolvePrincipal(request: Request): string | null {
    const bearer = headerValue(request.headers["authorization"]);
    if (bearer && bearer.startsWith("Bearer ")) {
        const userId = verifyAuthToken(bearer.slice("Bearer ".length).trim(), "api");
        if (userId !== null) return userId;
    }
    const cookie = parseCookie(request.headers["cookie"], MONITOR_SESSION_COOKIE);
    return cookie !== null ? verifyAuthToken(cookie, "session") : null;
}

function headerValue(raw: string | string[] | undefined): string | undefined {
    return Array.isArray(raw) ? raw[0] : raw;
}
