import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

export const TOOL_INVOKE_PATH = "/tools/invoke";
const MAX_BODY_BYTES = 64 * 1024;

export interface InvokeRequest {
    readonly token: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

export function headerCarrier(headers: IncomingHttpHeaders): Record<string, string> {
    const carrier: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (typeof value === "string") carrier[key] = value;
    }
    return carrier;
}

export function parseInvoke(raw: string): InvokeRequest {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) throw new Error("body must be an object");
    const record = parsed as Record<string, unknown>;
    const token = record["token"];
    const name = record["name"];
    const args = record["args"] ?? {};
    if (typeof token !== "string" || token.length === 0) throw new Error("token is required");
    if (typeof name !== "string" || name.length === 0) throw new Error("name is required");
    if (typeof args !== "object" || Array.isArray(args)) throw new Error("args must be an object");
    return { token, name, args: args as Record<string, unknown> };
}

export async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = chunk as Buffer;
        size += buffer.length;
        if (size > MAX_BODY_BYTES) throw new Error("body too large");
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
