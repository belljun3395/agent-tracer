import { randomUUID } from "node:crypto";
import net from "node:net";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import type express from "express";

export const REQUEST_ID_HEADER = "x-request-id";
export const TRUST_PROXY_SETTING = "loopback, linklocal, uniquelocal";

export interface RequestContext {
    readonly requestId: string;
    readonly clientIp: string;
}

export interface RequestContextIncomingMessage extends IncomingMessage {
    requestId?: string;
    clientIp?: string;
}

export interface HttpAccessLog {
    readonly type: "http_access";
    readonly requestId: string;
    readonly method: string;
    readonly path: string;
    readonly statusCode: number;
    readonly durationMs: number;
    readonly clientIp: string;
    readonly userAgent?: string;
}

export interface HttpUpgradeLog {
    readonly type: "http_upgrade";
    readonly requestId: string;
    readonly path: string;
    readonly accepted: boolean;
    readonly clientIp: string;
    readonly userAgent?: string;
}

type HeaderValue = string | readonly string[] | undefined;

export function configureTrustedProxy(app: ReturnType<typeof express>): void {
    app.set("trust proxy", TRUST_PROXY_SETTING);
}

export function createHttpRequestContext(request: express.Request): RequestContext {
    return {
        requestId: normalizeRequestId(request.get(REQUEST_ID_HEADER)),
        clientIp: normalizeIpAddress(request.ip)
            ?? resolveClientIp(request.headers, request.socket.remoteAddress)
            ?? "unknown",
    };
}

export function createUpgradeRequestContext(request: IncomingMessage): RequestContext {
    return {
        requestId: normalizeRequestId(firstHeaderValue(request.headers[REQUEST_ID_HEADER])),
        clientIp: resolveClientIp(request.headers, request.socket.remoteAddress) ?? "unknown",
    };
}

export function assignRequestContext(request: RequestContextIncomingMessage, context: RequestContext): void {
    request.requestId = context.requestId;
    request.clientIp = context.clientIp;
}

export function logHttpAccess(event: HttpAccessLog): void {
    writeStructuredLogLine(event);
}

export function logHttpUpgrade(event: HttpUpgradeLog): void {
    writeStructuredLogLine(event);
}

function writeStructuredLogLine(event: HttpAccessLog | HttpUpgradeLog): void {
    process.stdout.write(`${JSON.stringify(event)}\n`);
}

function resolveClientIp(headers: IncomingHttpHeaders, remoteAddress?: string): string | undefined {
    const remoteIp = normalizeIpAddress(remoteAddress);
    if (!remoteIp) return undefined;

    if (!isTrustedProxyAddress(remoteIp)) return remoteIp;

    return normalizeIpAddress(firstForwardedFor(headers["x-forwarded-for"])) ?? remoteIp;
}

function normalizeRequestId(value: string | undefined): string {
    const candidate = value?.trim();
    if (candidate && candidate.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(candidate)) {
        return candidate;
    }
    return randomUUID();
}

function firstForwardedFor(value: HeaderValue): string | undefined {
    return firstHeaderValue(value)
        ?.split(",")
        .map((part) => part.trim())
        .find((part) => part.length > 0);
}

function firstHeaderValue(value: HeaderValue): string | undefined {
    if (typeof value === "string") return value;
    return value?.[0];
}

function normalizeIpAddress(value: string | undefined): string | undefined {
    const candidate = value?.trim();
    if (!candidate) return undefined;

    const withoutIpv6Mapping = candidate.startsWith("::ffff:") ? candidate.slice("::ffff:".length) : candidate;
    if (net.isIP(withoutIpv6Mapping)) return withoutIpv6Mapping;
    return undefined;
}

function isTrustedProxyAddress(address: string): boolean {
    if (address === "::1" || address === "127.0.0.1") return true;

    const version = net.isIP(address);
    if (version === 4) return isTrustedIpv4(address);
    if (version === 6) return isTrustedIpv6(address);
    return false;
}

function isTrustedIpv4(address: string): boolean {
    const octets = address.split(".").map(Number);
    const first = octets[0];
    const second = octets[1];

    if (first === undefined || second === undefined) return false;

    return first === 10
        || first === 127
        || (first === 169 && second === 254)
        || (first === 172 && second >= 16 && second <= 31)
        || (first === 192 && second === 168);
}

function isTrustedIpv6(address: string): boolean {
    const lower = address.toLowerCase();
    return lower === "::1"
        || lower.startsWith("fe80:")
        || lower.startsWith("fc")
        || lower.startsWith("fd");
}
