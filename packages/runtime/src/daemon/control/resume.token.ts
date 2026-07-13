import * as fs from "node:fs";
import {randomBytes} from "node:crypto";
import type {AgentTracerPaths} from "~runtime/config/home.paths.js";

const TOKEN_FILE_MODE = 0o600;
const TOKEN_BYTES = 24;

/** 데몬 재기동 뒤에도 같은 값이 유지되도록 0600 파일의 인증 토큰을 재사용하거나 새로 발급한다. */
export function ensureResumeToken(paths: AgentTracerPaths): string {
    const existing = readExistingToken(paths.resumeTokenPath);
    if (existing !== null) return existing;
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    fs.writeFileSync(paths.resumeTokenPath, token, {mode: TOKEN_FILE_MODE});
    try {
        fs.chmodSync(paths.resumeTokenPath, TOKEN_FILE_MODE);
    } catch {
        // POSIX에서는 writeFile 시점에 권한이 적용되므로 실패해도 무해하다.
    }
    return token;
}

function readExistingToken(tokenPath: string): string | null {
    try {
        const content = fs.readFileSync(tokenPath, "utf8").trim();
        return content.length > 0 ? content : null;
    } catch {
        return null;
    }
}
