import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { context, propagation } from "@opentelemetry/api";
import { toolFailureText, unknownToolText } from "./tool.failure.js";
import type { ToolHandlers } from "./llm.runner.js";
import {
    headerCarrier,
    invokeErrorMessage,
    parseInvoke,
    readBody,
    send,
    TOOL_INVOKE_PATH,
} from "./tool.callback.protocol.js";
import { createToolCallbackToken, toolCallbackRejectionReason } from "./tool.callback.token.js";

/** 한 에이전트 실행에만 발급된 도구 콜백 권한이다. */
export interface ToolCallbackGrant {
    readonly url: string;
    readonly token: string;
    revoke(): void;
}

export interface ToolCallbackGranter {
    grant(handlers: ToolHandlers): ToolCallbackGrant;
}

/** 사이드카의 도구 호출을 워커 내부 핸들러로 전달한다. */
export class ToolCallbackServer implements ToolCallbackGranter {
    private readonly sessions = new Map<string, ToolHandlers>();
    private server: Server | null = null;

    constructor(
        private readonly port: number,
        private readonly advertisedUrl: string,
        private readonly instanceId: string,
    ) {}

    grant(handlers: ToolHandlers): ToolCallbackGrant {
        const token = createToolCallbackToken(this.instanceId);
        this.sessions.set(token, handlers);
        return {
            url: new URL(TOOL_INVOKE_PATH, this.advertisedUrl).toString(),
            token,
            revoke: () => {
                this.sessions.delete(token);
            },
        };
    }

    async start(): Promise<void> {
        const server = createServer((req, res) => {
            void this.handle(req, res);
        });
        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(this.port, "0.0.0.0", () => {
                server.off("error", reject);
                resolve();
            });
        });
        this.server = server;
    }

    async close(): Promise<void> {
        const server = this.server;
        if (server === null) return;
        this.server = null;
        this.sessions.clear();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (req.method !== "POST" || req.url !== TOOL_INVOKE_PATH) return send(res, 404, { error: "not found" });

        let body;
        try {
            body = parseInvoke(await readBody(req));
        } catch (error) {
            return send(res, 400, { error: invokeErrorMessage(error) });
        }

        const handlers = this.sessions.get(body.token);
        if (handlers === undefined) {
            return send(res, 403, { error: toolCallbackRejectionReason(body.token, this.instanceId) });
        }

        const handler = handlers[body.name];
        if (handler === undefined) {
            return send(res, 200, { content: unknownToolText(body.name, Object.keys(handlers)) });
        }

        const parentContext = propagation.extract(context.active(), headerCarrier(req.headers));
        try {
            return send(res, 200, { content: await context.with(parentContext, () => handler(body.args)) });
        } catch (error) {
            return send(res, 200, { content: toolFailureText(body.name, error) });
        }
    }
}
