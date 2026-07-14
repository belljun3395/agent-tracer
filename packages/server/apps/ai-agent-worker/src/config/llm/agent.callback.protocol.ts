import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

export const TOOL_INVOKE_PATH = "/tools/invoke";
export const COMPLETION_PATH = "/runs/complete";

const MAX_TOOL_BODY_BYTES = 64 * 1024;
// 완료 본문은 실행 궤적 전체를 싣고 오므로 도구 인자보다 훨씬 큰 상한이 필요하다.
const MAX_COMPLETION_BODY_BYTES = 8 * 1024 * 1024;

export interface InvokeRequest {
    readonly token: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

/** 실행 백엔드가 분리 실행을 끝내고 돌려주는 결과 봉투다. */
export interface CompletionRequest {
    readonly token: string;
    readonly response: Record<string, unknown>;
}

export function headerCarrier(headers: IncomingHttpHeaders): Record<string, string> {
    const carrier: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (typeof value === "string") carrier[key] = value;
    }
    return carrier;
}

export function parseInvoke(raw: string): InvokeRequest {
    const record = asRecord(raw);
    const token = record["token"];
    const name = record["name"];
    const args = record["args"] ?? {};
    if (typeof token !== "string" || token.length === 0) throw new Error("token is required");
    if (typeof name !== "string" || name.length === 0) throw new Error("name is required");
    if (typeof args !== "object" || Array.isArray(args)) throw new Error("args must be an object");
    return { token, name, args: args as Record<string, unknown> };
}

export function parseCompletion(raw: string): CompletionRequest {
    const record = asRecord(raw);
    const token = record["token"];
    const response = record["response"];
    if (typeof token !== "string" || token.length === 0) throw new Error("token is required");
    if (typeof response !== "object" || response === null || Array.isArray(response)) {
        throw new Error("response must be an object");
    }
    return { token, response: response as Record<string, unknown> };
}

function asRecord(raw: string): Record<string, unknown> {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) throw new Error("body must be an object");
    return parsed as Record<string, unknown>;
}

export async function readToolBody(req: IncomingMessage): Promise<string> {
    return readBody(req, MAX_TOOL_BODY_BYTES);
}

export async function readCompletionBody(req: IncomingMessage): Promise<string> {
    return readBody(req, MAX_COMPLETION_BODY_BYTES);
}

async function readBody(req: IncomingMessage, limit: number): Promise<string> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = chunk as Buffer;
        size += buffer.length;
        if (size > limit) throw new Error("body too large");
        chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
}

export function send(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
    const text = JSON.stringify(payload);
    res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
    res.end(text);
}

export function invokeErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
