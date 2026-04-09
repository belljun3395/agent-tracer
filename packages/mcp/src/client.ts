import { loadApplicationConfig, resolveMonitorHttpBaseUrl } from "../../../config/load-application-config.js";
const FETCH_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS: readonly [
    number,
    number,
    number
] = [200, 400, 800];
export class McpClientError extends Error {
    readonly code: "TIMEOUT" | "NETWORK" | "HTTP";
    readonly statusCode?: number;
    constructor(code: "TIMEOUT" | "NETWORK" | "HTTP", message: string, statusCode?: number) {
        super(message);
        this.name = "McpClientError";
        this.code = code;
        if (statusCode !== undefined) {
            this.statusCode = statusCode;
        }
    }
}
function isClientError(status: number): boolean {
    return status >= 400 && status < 500;
}
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            if (err instanceof McpClientError && err.code === "HTTP") {
                throw err;
            }
            const delayMs = RETRY_DELAYS_MS[attempt];
            if (attempt < MAX_RETRIES && delayMs !== undefined) {
                await sleep(delayMs);
            }
        }
    }
    throw lastError;
}
export interface SafePostResult {
    readonly [key: string]: unknown;
    readonly ok: boolean;
    readonly endpoint: string;
    readonly status?: number;
    readonly data?: unknown;
    readonly message: string;
}
export class MonitorClient {
    readonly baseUrl: string;
    constructor(baseUrl = resolveMonitorHttpBaseUrl(loadApplicationConfig(), process.env)) {
        this.baseUrl = baseUrl.replace(/\/+$/g, "");
    }
    private async request(method: "GET" | "POST", endpoint: string, payload?: unknown): Promise<SafePostResult> {
        try {
            return await withRetry(async () => {
                let response: Response;
                try {
                    const options: RequestInit = {
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                        ...(method === "POST" ? {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify(payload),
                        } : {}),
                    };
                    response = await fetch(`${this.baseUrl}${endpoint}`, options);
                }
                catch (err) {
                    if (err instanceof DOMException && err.name === "TimeoutError") {
                        throw new McpClientError("TIMEOUT", `request timed out after ${FETCH_TIMEOUT_MS}ms`);
                    }
                    throw new McpClientError("NETWORK", "monitor server unavailable");
                }
                if (!response.ok) {
                    if (isClientError(response.status)) {
                        throw new McpClientError("HTTP", `monitor server returned ${response.status}`, response.status);
                    }
                    throw new McpClientError("NETWORK", `monitor server returned ${response.status}`, response.status);
                }
                return {
                    ok: true,
                    endpoint,
                    status: response.status,
                    data: (await response.json()) as unknown,
                    message: method === "POST" ? "monitor event recorded" : "ok",
                };
            });
        }
        catch (err) {
            if (err instanceof McpClientError) {
                return {
                    ok: false,
                    endpoint,
                    ...(err.statusCode !== undefined ? { status: err.statusCode } : {}),
                    message: err.code === "TIMEOUT"
                        ? `monitor server timed out; event ignored`
                        : err.code === "HTTP"
                            ? `monitor server returned ${err.statusCode}; event ignored`
                            : "monitor server unavailable; event ignored"
                };
            }
            return { ok: false, endpoint, message: "monitor server unavailable; event ignored" };
        }
    }
    async get(endpoint: string): Promise<SafePostResult> {
        return this.request("GET", endpoint);
    }
    async post(endpoint: string, payload: unknown): Promise<SafePostResult> {
        return this.request("POST", endpoint, payload);
    }
}
