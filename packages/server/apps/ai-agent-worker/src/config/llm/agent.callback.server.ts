import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { context, propagation } from "@opentelemetry/api";
import { toolFailureText, unknownToolText } from "./tool.failure.js";
import type { ToolHandlers } from "./llm.runner.js";
import {
    COMPLETION_PATH,
    headerCarrier,
    invokeErrorMessage,
    parseCompletion,
    parseInvoke,
    readCompletionBody,
    readToolBody,
    send,
    TOOL_INVOKE_PATH,
} from "./agent.callback.protocol.js";
import { createCallbackToken, callbackRejectionReason } from "./agent.callback.token.js";

/** 한 에이전트 실행에만 발급된 콜백 권한이다. */
export interface CallbackGrant {
    readonly url: string;
    readonly token: string;
    revoke(): void;
}

export interface ToolCallbackGranter {
    grantTools(handlers: ToolHandlers): CallbackGrant;
}

/** 분리 실행의 결과를 그 실행을 기다리는 쪽으로 넘긴다. */
export type CompletionHandler = (response: Record<string, unknown>) => void;

export interface CompletionCallbackGranter {
    grantCompletion(handle: CompletionHandler): CallbackGrant;
}

/** 실행 백엔드의 도구 호출과 완료 통지를 워커 안으로 받아들인다. */
export class AgentCallbackServer implements ToolCallbackGranter, CompletionCallbackGranter {
    private readonly toolSessions = new Map<string, ToolHandlers>();
    private readonly completionSessions = new Map<string, CompletionHandler>();
    private server: Server | null = null;

    constructor(
        private readonly port: number,
        private readonly advertisedUrl: string,
        private readonly instanceId: string,
    ) {}

    grantTools(handlers: ToolHandlers): CallbackGrant {
        return this.grant(this.toolSessions, handlers, TOOL_INVOKE_PATH);
    }

    grantCompletion(handle: CompletionHandler): CallbackGrant {
        return this.grant(this.completionSessions, handle, COMPLETION_PATH);
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
        this.toolSessions.clear();
        this.completionSessions.clear();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    private grant<T>(sessions: Map<string, T>, session: T, path: string): CallbackGrant {
        const token = createCallbackToken(this.instanceId);
        sessions.set(token, session);
        return {
            url: new URL(path, this.advertisedUrl).toString(),
            token,
            revoke: () => {
                sessions.delete(token);
            },
        };
    }

    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (req.method !== "POST") return send(res, 404, { error: "not found" });
        if (req.url === TOOL_INVOKE_PATH) return this.handleTool(req, res);
        if (req.url === COMPLETION_PATH) return this.handleCompletion(req, res);
        return send(res, 404, { error: "not found" });
    }

    private async handleTool(req: IncomingMessage, res: ServerResponse): Promise<void> {
        let body;
        try {
            body = parseInvoke(await readToolBody(req));
        } catch (error) {
            return send(res, 400, { error: invokeErrorMessage(error) });
        }

        const handlers = this.toolSessions.get(body.token);
        if (handlers === undefined) {
            return send(res, 403, { error: callbackRejectionReason(body.token, this.instanceId) });
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

    private async handleCompletion(req: IncomingMessage, res: ServerResponse): Promise<void> {
        let body;
        try {
            body = parseCompletion(await readCompletionBody(req));
        } catch (error) {
            return send(res, 400, { error: invokeErrorMessage(error) });
        }

        const handle = this.completionSessions.get(body.token);
        if (handle === undefined) {
            return send(res, 403, { error: callbackRejectionReason(body.token, this.instanceId) });
        }
        // 결과를 받은 창구는 그 자리에서 닫아 같은 실행의 재전달을 막는다.
        this.completionSessions.delete(body.token);
        handle(body.response);
        return send(res, 200, { accepted: true });
    }
}
