import {isRecord} from "~runtime/support/json.js";

/** MCP stdio 전송 규약이며 줄바꿈으로 구분된 JSON-RPC 2.0 메시지 하나가 한 줄이다. */
export interface JsonRpcRequest {
    readonly jsonrpc: "2.0";
    readonly id?: string | number;
    readonly method: string;
    readonly params?: unknown;
}

export interface JsonRpcSuccess {
    readonly jsonrpc: "2.0";
    readonly id: string | number;
    readonly result: unknown;
}

export interface JsonRpcFailure {
    readonly jsonrpc: "2.0";
    readonly id: string | number | null;
    readonly error: {readonly code: number; readonly message: string};
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
    return isRecord(value) && typeof value["method"] === "string";
}

/** stdin을 줄 단위로 잘라 완전한 JSON-RPC 요청만 콜백에 넘기고 깨진 줄은 조용히 버린다. */
export function readJsonRpcRequests(
    stream: NodeJS.ReadableStream,
    onRequest: (request: JsonRpcRequest) => void,
): void {
    let buffer = "";
    stream.on("data", (chunk: Buffer | string) => {
        buffer += chunk.toString("utf8");
        let index = buffer.indexOf("\n");
        while (index !== -1) {
            const line = buffer.slice(0, index).trim();
            buffer = buffer.slice(index + 1);
            if (line) {
                try {
                    const parsed = JSON.parse(line) as unknown;
                    if (isJsonRpcRequest(parsed)) onRequest(parsed);
                } catch {
                    // 깨진 줄은 프로토콜 위반이므로 버리고 다음 줄을 본다.
                }
            }
            index = buffer.indexOf("\n");
        }
    });
}

export function writeJsonRpcMessage(
    stream: NodeJS.WritableStream,
    message: JsonRpcSuccess | JsonRpcFailure,
): void {
    stream.write(`${JSON.stringify(message)}\n`);
}
