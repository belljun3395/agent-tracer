import { HttpException, HttpStatus, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { TokenBucketLimiter } from "@monitor/platform";
import { createApiErrorEnvelope, DEFAULT_USER_ID, MONITOR_USER_HEADER } from "@monitor/kernel";
import { SKIP_GATE_METADATA_KEY } from "~tracer-api/support/skip-gate.decorator.js";

const DEFAULT_CAPACITY = 1200;
const DEFAULT_REFILL_PER_SEC = 40;

function envInt(name: string, fallback: number): number {
    const raw = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function resolveApiRateLimiter(): TokenBucketLimiter {
    const capacity = envInt("MONITOR_API_RATE_LIMIT_CAPACITY", DEFAULT_CAPACITY);
    const refillPerSec = envInt("MONITOR_API_RATE_LIMIT_REFILL_PER_SEC", DEFAULT_REFILL_PER_SEC);
    return new TokenBucketLimiter({ capacity, refillPerMs: refillPerSec / 1000 });
}

/** 사용자별 토큰 버킷으로 API 요청을 제한하고 초과하면 429와 Retry-After를 응답한다. */
@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(private readonly limiter: TokenBucketLimiter, private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        if (context.getType() !== "http") return true;
        if (this.reflector.getAllAndOverride<boolean | undefined>(SKIP_GATE_METADATA_KEY, [context.getHandler(), context.getClass()])) {
            return true;
        }
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();
        const userId = headerValue(request.headers[MONITOR_USER_HEADER])?.trim() || DEFAULT_USER_ID;
        const result = this.limiter.consume(userId);
        if (result.allowed) return true;

        response.setHeader("Retry-After", String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
        throw new HttpException(
            createApiErrorEnvelope("rate_limited", "API rate limit exceeded"),
            HttpStatus.TOO_MANY_REQUESTS,
        );
    }
}

function headerValue(raw: string | string[] | undefined): string | undefined {
    return Array.isArray(raw) ? raw[0] : raw;
}
