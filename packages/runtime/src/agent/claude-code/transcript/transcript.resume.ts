import * as fs from "node:fs";
import * as readline from "node:readline";
import {parseJsonLine} from "~runtime/agent/claude-code/transcript/transcript.reader.js";

/** 훅 한 번이 재개 판정을 위해 앞에서부터 읽는 최대 줄 수다. */
export const RESUME_SCAN_MAX_LINES = 20_000;

/**
 * 트랜스크립트 JSONL을 앞에서부터 훑어 현재 세션 ID와 다른 session_id 중
 * 파일에서 가장 마지막에 나타나는 값을 직전 런타임 세션 ID로 본다.
 */
export function findResumedSessionId(
    transcriptPath: string,
    currentSessionId: string,
    maxLines: number = RESUME_SCAN_MAX_LINES,
): Promise<string | undefined> {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return Promise.resolve(undefined);

    return new Promise((resolve) => {
        let resumedFrom: string | undefined;
        let lineCount = 0;
        let settled = false;

        const finish = (value: string | undefined): void => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        const stream = fs.createReadStream(transcriptPath, {encoding: "utf8"});
        stream.on("error", () => finish(undefined));

        const rl = readline.createInterface({input: stream, crlfDelay: Infinity});
        rl.on("error", () => finish(undefined));
        rl.on("line", (line) => {
            lineCount += 1;
            if (lineCount > maxLines) {
                rl.close();
                stream.destroy();
                return;
            }

            const parsed = parseJsonLine(line);
            if (!parsed) return;

            const sessionId = parsed["session_id"];
            if (typeof sessionId === "string" && sessionId && sessionId !== currentSessionId) {
                resumedFrom = sessionId;
            }
        });
        rl.on("close", () => finish(resumedFrom));
    });
}
