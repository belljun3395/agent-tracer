import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { logInfo, logWarn } from "~ai-agent-worker/support/log.js";
import {
    COMPLETION_PATH,
    badRequestMessage,
    parseCompletion,
    readCompletionBody,
    send,
} from "./agent.completion.protocol.js";
import type { CompletionInbox } from "./durable.completion.inbox.js";

/** 실행 백엔드가 분리 실행을 끝내고 보내는 완료 통지를 워커 안으로 받아들인다. */
export class AgentCompletionServer {
    private server: Server | null = null;

    constructor(
        private readonly port: number,
        private readonly completionInbox: CompletionInbox,
    ) {}

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
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (req.method !== "POST" || req.url !== COMPLETION_PATH) {
            return send(res, 404, { error: "not found" });
        }

        let body;
        try {
            body = parseCompletion(await readCompletionBody(req));
        } catch (error) {
            return send(res, 400, { error: badRequestMessage(error) });
        }

        const accepted = await this.completionInbox.accept(body.token, body.response);
        if (accepted === "accepted") return send(res, 200, { accepted: true });
        // 완료 결과는 pending inbox만 수락해 취소·만료 뒤 늦은 결과를 버린다.
        if (accepted === "duplicate") {
            logInfo({ msg: "completion.callback.duplicate" });
            return send(res, 200, { accepted: true, duplicate: true });
        }
        // 늦게 도착한 콜백이 이미 닫힌(취소·만료) 창구나 알 수 없는 토큰과 만나 유료 결과가 버려지는 경로다.
        logWarn({ msg: "completion.callback.rejected", outcome: accepted });
        return send(res, accepted === "unknown" ? 403 : 409, { error: "completion callback is closed" });
    }
}
