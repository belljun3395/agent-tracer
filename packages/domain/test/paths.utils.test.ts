import { describe, expect, it } from "vitest";
import { extractPathLikeTokens, looksLikePath, looksLikePathStrict } from "@monitor/domain";

describe("looksLikePathStrict", () => {
    it("accepts tokens with a recognizable file extension", () => {
        expect(looksLikePathStrict("README.md")).toBe(true);
        expect(looksLikePathStrict("src/foo.ts")).toBe(true);
        expect(looksLikePathStrict("packages/core/src/paths/utils.ts")).toBe(true);
    });

    it("accepts dotfile/dot-directory rooted paths", () => {
        expect(looksLikePathStrict(".github/workflows/ci.yml")).toBe(true);
        expect(looksLikePathStrict(".claude/plugin/foo.json")).toBe(true);
    });

    it("accepts explicitly relative or absolute path prefixes", () => {
        expect(looksLikePathStrict("./foo/bar")).toBe(true);
        expect(looksLikePathStrict("../sibling/module")).toBe(true);
        expect(looksLikePathStrict("/usr/local/bin/node")).toBe(true);
    });

    it("accepts project-rooted prefixes without extensions", () => {
        expect(looksLikePathStrict("src/components/hero")).toBe(true);
        expect(looksLikePathStrict("packages/core/test")).toBe(true);
        expect(looksLikePathStrict("docs/architecture")).toBe(true);
    });

    it("rejects PascalCase identifier pairs that look like tool names", () => {
        expect(looksLikePathStrict("PostToolUse/Explore")).toBe(false);
        expect(looksLikePathStrict("TaskCreate/TaskUpdate")).toBe(false);
        expect(looksLikePathStrict("Foo/Bar")).toBe(false);
    });

    it("rejects slash-separated lowercase identifiers with no path evidence", () => {
        expect(looksLikePathStrict("does/not/exist/probe")).toBe(false);
    });

    it("still accepts single-token files without slashes", () => {
        expect(looksLikePathStrict("package.json")).toBe(true);
        expect(looksLikePathStrict(".env")).toBe(true);
    });
});

describe("looksLikePath (loose)", () => {
    it("keeps accepting slash-separated identifiers when trusted", () => {
        // Backtick-wrapped or @-prefixed tokens use this path and should remain permissive.
        expect(looksLikePath("PostToolUse/Explore")).toBe(true);
        expect(looksLikePath("src/foo.ts")).toBe(true);
    });
});

describe("extractPathLikeTokens", () => {
    it("extracts real file paths while filtering out tool-name pairs in plain text", () => {
        const text = [
            "Looking at src/foo.ts and `README.md`,",
            "also packages/core/src/paths/utils.ts and `.github/workflows/ci.yml`,",
            "the PostToolUse/Explore and TaskCreate/TaskUpdate hooks fire during probe,",
            "tried does/not/exist/probe and Foo/Bar lookups",
        ].join(" ");

        const extracted = new Set(extractPathLikeTokens(text));

        expect(extracted.has("src/foo.ts")).toBe(true);
        expect(extracted.has("README.md")).toBe(true);
        expect(extracted.has("packages/core/src/paths/utils.ts")).toBe(true);
        expect(extracted.has(".github/workflows/ci.yml")).toBe(true);

        expect(extracted.has("PostToolUse/Explore")).toBe(false);
        expect(extracted.has("TaskCreate/TaskUpdate")).toBe(false);
        expect(extracted.has("does/not/exist/probe")).toBe(false);
        expect(extracted.has("Foo/Bar")).toBe(false);
    });

    it("keeps trusted backticked tokens even when they look like identifier pairs", () => {
        // User explicitly backticked the token, so we preserve the looser semantics.
        const text = "The plugin emits `PostToolUse/Explore` events frequently.";
        const extracted = new Set(extractPathLikeTokens(text));
        expect(extracted.has("PostToolUse/Explore")).toBe(true);
    });

    it("keeps @-prefixed references as trusted path tokens", () => {
        const text = "Please review @src/lib/helper and @Foo/Bar today.";
        const extracted = new Set(extractPathLikeTokens(text));
        expect(extracted.has("src/lib/helper")).toBe(true);
        // `@Foo/Bar` is trusted because the author explicitly tagged it.
        expect(extracted.has("Foo/Bar")).toBe(true);
    });
});
