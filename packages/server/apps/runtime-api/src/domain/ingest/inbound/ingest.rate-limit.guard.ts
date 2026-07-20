import { HttpException, HttpStatus, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { TokenBucketLimiter } from "@monitor/platform";
import { createApiErrorEnvelope, DEFAULT_USER_ID, MONITOR_USER_HEADER } from "@monitor/kernel";
import { SKIP_GATE_METADATA_KEY } from "~runtime-api/support/skip-gate.decorator.js";
import { IngestGateLogService } from "~runtime-api/domain/ingest/application/ingest.gate.log.service.js";

// 데몬이 429를 재시도 대상으로 분류하므로 Retry-After 없이 거부하면 즉시 재요청 폭주가 된다.
const DEFAULT_CAPACITY = 2000;
const DEFAULT_REFILL_PER_SEC = 200;

export const INGEST_RATE_LIMIT_CONFIG = Symbol("INGEST_RATE_LIMIT_CONFIG");

/** env로 정한 인제스트 토큰 버킷 용량과 초당 리필량이며, 부트 로그와 429 로그가 함께 참조한다. */
export interface IngestRateLimitConfig {
    readonly capacity: number;
    readonly refillPerSec: number;
}

function envInt(name: string, fallback: number): number {
    const raw = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function resolveIngestRateLimitConfig(): IngestRateLimitConfig {
    return {
        capacity: envInt("MONITOR_INGEST_RATE_LIMIT_CAPACITY", DEFAULT_CAPACITY),
        refillPerSec: envInt("MONITOR_INGEST_RATE_LIMIT_REFILL_PER_SEC", DEFAULT_REFILL_PER_SEC),
    };
}

export function resolveIngestRateLimiter(): TokenBucketLimiter {
    const { capacity, refillPerSec } = resolveIngestRateLimitConfig();
    return new TokenBucketLimiter({ capacity, refillPerMs: refillPerSec / 1000 });
}

@Injectable()
export class IngestRateLimitGuard implements CanActivate {
    constructor(
        private readonly limiter: TokenBucketLimiter,
        private readonly reflector: Reflector,
        private readonly gateLog: IngestGateLogService,
        @Inject(INGEST_RATE_LIMIT_CONFIG) private readonly config: IngestRateLimitConfig = resolveIngestRateLimitConfig(),
    ) {}

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

        this.gateLog.rateLimited({
            userId,
            capacity: this.config.capacity,
            refillPerSec: this.config.refillPerSec,
            retryAfterMs: result.retryAfterMs,
        });
        response.setHeader("Retry-After", String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
        throw new HttpException(
            createApiErrorEnvelope("rate_limited", "ingest rate limit exceeded"),
            HttpStatus.TOO_MANY_REQUESTS,
        );
    }
}

function headerValue(raw: string | string[] | undefined): string | undefined {
    return Array.isArray(raw) ? raw[0] : raw;
}
