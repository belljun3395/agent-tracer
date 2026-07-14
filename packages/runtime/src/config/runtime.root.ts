/** 소스 실행과 번들 실행은 파일 깊이가 다르므로 매니페스트를 만날 때까지 거슬러 올라가 런타임 루트를 찾는다. */
import * as fs from "node:fs";
import * as path from "node:path";
import {fileURLToPath} from "node:url";
import {isRecord} from "~runtime/support/json.js";

// 플러그인 클론은 패키지 매니페스트 대신 플러그인 매니페스트만 가질 수 있다.
const ROOT_MANIFESTS = ["package.json", ".claude-plugin/plugin.json"] as const;

function manifestDir(dir: string): boolean {
    return ROOT_MANIFESTS.some((manifest) => fs.existsSync(path.join(dir, manifest)));
}

/** 훅 번들과 데몬 번들과 소스가 모두 같은 디렉터리를 런타임 루트로 본다. */
export function resolveRuntimeRoot(
    from: string = path.dirname(fileURLToPath(import.meta.url)),
): string {
    const start = path.resolve(from);
    let current = start;
    for (;;) {
        if (manifestDir(current)) return current;
        const parent = path.dirname(current);
        if (parent === current) return start;
        current = parent;
    }
}

/** 런타임 루트의 매니페스트에서 배포 버전을 읽고 없으면 빈 문자열이다. */
export function readRuntimeManifestVersion(root: string = resolveRuntimeRoot()): string {
    for (const manifest of ROOT_MANIFESTS) {
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(path.join(root, manifest), "utf8"));
            const version = isRecord(parsed) && typeof parsed["version"] === "string" ? parsed["version"].trim() : "";
            if (version) return version;
        } catch {
            continue;
        }
    }
    return "";
}
