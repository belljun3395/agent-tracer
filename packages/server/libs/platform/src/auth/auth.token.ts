import { createHmac, timingSafeEqual } from "node:crypto";

/** 인증 토큰은 저장소 없이 서명만으로 검증하는 무상태 토큰이다. */
export type AuthTokenPurpose = "api" | "session";

interface AuthTokenPayload {
    readonly userId: string;
    readonly purpose: AuthTokenPurpose;
    readonly issuedAt: number;
    readonly expiresAt: number | null;
}

const TOKEN_PREFIX = "mt1";

function resolveSecret(): string | null {
    const secret = process.env["MONITOR_AUTH_TOKEN_SECRET"];
    return secret !== undefined && secret.trim().length > 0 ? secret.trim() : null;
}

/** 인증 강제는 서명 비밀이 설정된 token 모드에서만 켜지고 그 밖에는 자기신고를 허용한다. */
export function isAuthEnforced(): boolean {
    return process.env["MONITOR_AUTH_MODE"] === "token" && resolveSecret() !== null;
}

function sign(payloadB64: string, secret: string): string {
    return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export interface IssueAuthTokenInput {
    readonly userId: string;
    readonly purpose: AuthTokenPurpose;
    readonly ttlMs: number | null;
    readonly now?: Date;
}

/** 서명 비밀을 아는 쪽만 토큰을 만들 수 있으므로 비밀 보유가 곧 발급 권한이다. */
export function issueAuthToken(input: IssueAuthTokenInput): string {
    const secret = resolveSecret();
    if (secret === null) {
        throw new Error("MONITOR_AUTH_TOKEN_SECRET이 설정되지 않아 토큰을 발급할 수 없다.");
    }
    const issuedAt = (input.now ?? new Date()).getTime();
    const payload: AuthTokenPayload = {
        userId: input.userId,
        purpose: input.purpose,
        issuedAt,
        expiresAt: input.ttlMs === null ? null : issuedAt + input.ttlMs,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return `${TOKEN_PREFIX}.${payloadB64}.${sign(payloadB64, secret)}`;
}

/** purpose가 일치해야만 userId를 내주므로 세션 쿠키와 API 베어러를 맞바꿔 쓰는 토큰 혼동 공격이 막힌다. */
export function verifyAuthToken(
    token: string,
    purpose: AuthTokenPurpose,
    now: Date = new Date(),
): string | null {
    const secret = resolveSecret();
    if (secret === null) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [prefix, payloadB64, signature] = parts;
    if (prefix !== TOKEN_PREFIX || !payloadB64 || !signature) return null;

    const expected = sign(payloadB64, secret);
    const actual = Buffer.from(signature, "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");
    if (actual.length !== expectedBuf.length || !timingSafeEqual(actual, expectedBuf)) return null;

    let payload: AuthTokenPayload;
    try {
        payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as AuthTokenPayload;
    } catch {
        return null;
    }
    if (payload.purpose !== purpose) return null;
    if (typeof payload.userId !== "string" || payload.userId.length === 0) return null;
    if (payload.expiresAt !== null && payload.expiresAt < now.getTime()) return null;
    return payload.userId;
}

/** 별도 관리자 계정 체계 없이 서명 비밀 자체가 토큰 발급 엔드포인트의 부트스트랩 권한이다. */
export function isAdminSecretValid(candidate: string | undefined): boolean {
    const secret = resolveSecret();
    if (secret === null || candidate === undefined || candidate.length === 0) return false;
    const candidateBuf = Buffer.from(candidate, "utf8");
    const secretBuf = Buffer.from(secret, "utf8");
    return candidateBuf.length === secretBuf.length && timingSafeEqual(candidateBuf, secretBuf);
}
