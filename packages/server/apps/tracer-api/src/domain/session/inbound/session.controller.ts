import { Controller, Delete, Headers, HttpCode, HttpStatus, Post, Res, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import { clearedSessionCookie, isAuthEnforced, issueAuthToken, serializeSessionCookie, verifyAuthToken } from "@monitor/platform";
import { MONITOR_SESSION_COOKIE, SESSION_TTL_MS } from "~tracer-api/support/session.const.js";
import { SkipGate } from "~tracer-api/support/skip-gate.decorator.js";
import { NoEnvelope } from "~tracer-api/support/no-envelope.decorator.js";

/** 유효한 발급 토큰을 이후 요청의 신원이 되는 세션 쿠키로 교환하는 HTTP 계약이다. */
@SkipGate()
@Controller("api/v1/session")
export class SessionController {
    @Post()
    @HttpCode(HttpStatus.OK)
    @NoEnvelope()
    create(
        @Headers("authorization") authorization: string | undefined,
        @Res({ passthrough: true }) response: Response,
    ): { readonly userId: string } {
        if (!isAuthEnforced()) throw new UnauthorizedException("auth is not enforced");
        if (!authorization?.startsWith("Bearer ")) throw new UnauthorizedException("bearer token required");

        const userId = verifyAuthToken(authorization.slice("Bearer ".length).trim(), "api");
        if (userId === null) throw new UnauthorizedException("invalid bearer token");

        const session = issueAuthToken({ userId, purpose: "session", ttlMs: SESSION_TTL_MS });
        response.setHeader(
            "Set-Cookie",
            serializeSessionCookie(MONITOR_SESSION_COOKIE, session, {
                maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000),
                secure: isSecureDeployment(),
            }),
        );
        return { userId };
    }

    @Delete()
    @HttpCode(HttpStatus.OK)
    @NoEnvelope()
    destroy(@Res({ passthrough: true }) response: Response): { readonly cleared: true } {
        response.setHeader("Set-Cookie", clearedSessionCookie(MONITOR_SESSION_COOKIE, isSecureDeployment()));
        return { cleared: true };
    }
}

// 브라우저는 http에서 Secure 쿠키를 저장하지 않으므로 https 배포에서만 건다.
function isSecureDeployment(): boolean {
    return process.env["MONITOR_SESSION_COOKIE_SECURE"] === "1";
}
