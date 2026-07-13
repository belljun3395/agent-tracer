import { ForbiddenException, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { isAuthEnforced, verifyAuthToken } from "@monitor/platform";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { SKIP_GATE_METADATA_KEY } from "~runtime-api/support/skip-gate.decorator.js";

// 인증이 켜지면 베어러 토큰만 신원의 근거이고 검증된 userId를 자기신고 헤더에 덮어쓴다.
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
        const bearer = headerValue(request.headers["authorization"]);
        const userId = bearer?.startsWith("Bearer ") === true
            ? verifyAuthToken(bearer.slice("Bearer ".length).trim(), "api")
            : null;
        if (userId === null) throw new UnauthorizedException("valid bearer token required");

        const claimed = headerValue(request.headers[MONITOR_USER_HEADER]);
        if (claimed !== undefined && claimed.trim().length > 0 && claimed.trim() !== userId) {
            throw new ForbiddenException("self-reported user does not match the authenticated token");
        }
        request.headers[MONITOR_USER_HEADER] = userId;
        return true;
    }
}

function headerValue(raw: string | string[] | undefined): string | undefined {
    return Array.isArray(raw) ? raw[0] : raw;
}
