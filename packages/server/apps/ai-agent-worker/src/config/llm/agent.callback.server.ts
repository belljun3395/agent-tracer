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
import type { CompletionInbox } from "./durable.completion.inbox.js";

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
/** 실행 백엔드의 도구 호출과 완료 통지를 워커 안으로 받아들인다. */
export class AgentCallbackServer implements ToolCallbackGranter {
    private readonly toolSessions = new Map<string, ToolHandlers>();
    private server: Server | null = null;

    constructor(
        private readonly port: number,
        private readonly advertisedUrl: string,
        private readonly instanceId: string,
        private readonly completionInbox: CompletionInbox,
    ) {}

    grantTools(handlers: ToolHandlers): CallbackGrant {
        return this.grant(this.toolSessions, handlers, TOOL_INVOKE_PATH);
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

        const accepted = await this.completionInbox.accept(body.token, body.response);
        if (accepted === "accepted") return send(res, 200, { accepted: true });
        // 완료 결과는 pending inbox만 수락해 취소·만료 뒤 늦은 결과를 버린다.
        if (accepted === "duplicate") return send(res, 200, { accepted: true, duplicate: true });
        return send(res, accepted === "unknown" ? 403 : 409, { error: "completion callback is closed" });
    }
}
