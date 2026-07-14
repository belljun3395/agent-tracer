import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {readRuntimeManifestVersion, resolveRuntimeRoot} from "~runtime/config/runtime.root.js";

const roots: string[] = [];

function makeRoot(manifests: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-root-"));
    roots.push(root);
    for (const [name, version] of Object.entries(manifests)) {
        const file = path.join(root, name);
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.writeFileSync(file, JSON.stringify({version}));
    }
    return root;
}

afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, {recursive: true, force: true});
});

describe("런타임 매니페스트 버전", () => {
    it("플러그인 매니페스트가 패키지 매니페스트를 이긴다", () => {
        const root = makeRoot({"package.json": "0.7.0", ".claude-plugin/plugin.json": "0.7.1"});

        expect(readRuntimeManifestVersion(root)).toBe("0.7.1");
    });

    it("플러그인 매니페스트만 있으면 그것을 읽는다", () => {
        const root = makeRoot({".claude-plugin/plugin.json": "1.2.3"});

        expect(readRuntimeManifestVersion(root)).toBe("1.2.3");
    });

    it("패키지 매니페스트만 있으면 그것을 읽는다", () => {
        const root = makeRoot({"package.json": "4.5.6"});

        expect(readRuntimeManifestVersion(root)).toBe("4.5.6");
    });

    it("매니페스트가 없으면 빈 문자열이다", () => {
        const root = makeRoot({});

        expect(readRuntimeManifestVersion(root)).toBe("");
    });

    it("매니페스트를 만날 때까지 거슬러 올라가 루트를 찾는다", () => {
        const root = makeRoot({".claude-plugin/plugin.json": "0.7.1"});
        const deep = path.join(root, "dist", "daemon");
        fs.mkdirSync(deep, {recursive: true});

        expect(fs.realpathSync(resolveRuntimeRoot(deep))).toBe(fs.realpathSync(root));
    });
});
