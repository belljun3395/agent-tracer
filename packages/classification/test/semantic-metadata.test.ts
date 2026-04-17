import { describe, expect, it } from "vitest";
import {
    inferCommandSemantic,
    inferFileToolSemantic,
    inferExploreSemantic,
    inferMcpSemantic,
    inferSkillSemantic,
    inferAgentSemantic,
    buildSemanticMetadata,
    deriveSemanticMetadata,
} from "../src/semantic-metadata.js";

describe("inferCommandSemantic", () => {
    it("classifies read-only probes as exploration/shell_probe", () => {
        const result = inferCommandSemantic("ls -la packages");
        expect(result.lane).toBe("exploration");
        expect(result.metadata).toMatchObject({
            subtypeKey: "shell_probe",
            subtypeGroup: "shell",
            operation: "probe",
            entityName: "ls",
            sourceTool: "Bash",
        });
    });

    it("classifies git status as exploration", () => {
        expect(inferCommandSemantic("git status").lane).toBe("exploration");
    });

    it("classifies test runners as run_test", () => {
        expect(inferCommandSemantic("npm test").metadata.subtypeKey).toBe("run_test");
        expect(inferCommandSemantic("pnpm run test").metadata.subtypeKey).toBe("run_test");
        expect(inferCommandSemantic("vitest run").metadata.subtypeKey).toBe("run_test");
    });

    it("classifies lint commands as run_lint", () => {
        expect(inferCommandSemantic("eslint src").metadata.subtypeKey).toBe("run_lint");
        expect(inferCommandSemantic("npm run lint").metadata.subtypeKey).toBe("run_lint");
    });

    it("classifies verify/typecheck as verify", () => {
        expect(inferCommandSemantic("npm run typecheck").metadata.subtypeKey).toBe("verify");
        expect(inferCommandSemantic("mypy src").metadata.subtypeKey).toBe("verify");
        expect(inferCommandSemantic("cargo check").metadata.subtypeKey).toBe("verify");
    });

    it("classifies build commands as run_build", () => {
        expect(inferCommandSemantic("npm run build").metadata.subtypeKey).toBe("run_build");
        expect(inferCommandSemantic("cargo build --release").metadata.subtypeKey).toBe("run_build");
    });

    it("falls back to run_command for unknown commands", () => {
        const result = inferCommandSemantic("curl https://example.com");
        expect(result.lane).toBe("implementation");
        expect(result.metadata.subtypeKey).toBe("run_command");
        expect(result.metadata.entityName).toBe("curl");
    });

    it("classifies rule/policy checks", () => {
        expect(inferCommandSemantic("deno lint --rule ban-untagged-todo").metadata.subtypeKey).toBe(
            "rule_check"
        );
    });
});

describe("inferFileToolSemantic", () => {
    it("classifies Edit/MultiEdit/patch as apply_patch", () => {
        expect(inferFileToolSemantic("apply_patch", "src/a.ts").subtypeKey).toBe("apply_patch");
    });

    it("classifies Write/create tools as create_file", () => {
        expect(inferFileToolSemantic("Write", "new.ts").subtypeKey).toBe("create_file");
    });

    it("classifies delete tools as delete_file", () => {
        expect(inferFileToolSemantic("DeleteFile", "stale.ts").subtypeKey).toBe("delete_file");
    });

    it("falls back to modify_file", () => {
        expect(inferFileToolSemantic("Edit", "pkg.json").subtypeKey).toBe("modify_file");
    });

    it("preserves entityName when provided", () => {
        expect(inferFileToolSemantic("Write", "path/to/file.ts").entityName).toBe("path/to/file.ts");
    });
});

describe("inferExploreSemantic", () => {
    it("classifies Read as read_file", () => {
        const result = inferExploreSemantic("Read", { entityName: "src/index.ts" });
        expect(result.subtypeKey).toBe("read_file");
        expect(result.entityName).toBe("src/index.ts");
    });

    it("classifies Glob as glob_files", () => {
        expect(inferExploreSemantic("Glob").subtypeKey).toBe("glob_files");
    });

    it("classifies Grep as grep_code", () => {
        expect(inferExploreSemantic("Grep").subtypeKey).toBe("grep_code");
    });

    it("classifies WebFetch with url as web_fetch", () => {
        const result = inferExploreSemantic("WebFetch", { queryOrUrl: "https://example.com" });
        expect(result.subtypeKey).toBe("web_fetch");
        expect(result.entityName).toBe("https://example.com");
    });

    it("classifies WebSearch with query as web_search", () => {
        const result = inferExploreSemantic("WebSearch", { queryOrUrl: "hexagonal architecture" });
        expect(result.subtypeKey).toBe("web_search");
        expect(result.entityName).toBe("hexagonal architecture");
    });
});

describe("inferMcpSemantic / inferSkillSemantic / inferAgentSemantic", () => {
    it("builds mcp_call metadata", () => {
        const result = inferMcpSemantic("context7", "resolve-library-id");
        expect(result).toMatchObject({
            subtypeKey: "mcp_call",
            entityType: "mcp",
            entityName: "context7/resolve-library-id",
            sourceTool: "mcp__context7__resolve-library-id",
        });
    });

    it("builds skill_use metadata", () => {
        const result = inferSkillSemantic("writing-plans");
        expect(result).toMatchObject({
            subtypeKey: "skill_use",
            entityType: "skill",
            entityName: "writing-plans",
        });
    });

    it("builds delegation metadata", () => {
        const result = inferAgentSemantic("code-reviewer");
        expect(result).toMatchObject({
            subtypeKey: "delegation",
            entityType: "agent",
            entityName: "code-reviewer",
        });
    });
});

describe("buildSemanticMetadata", () => {
    it("humanizes missing subtypeLabel", () => {
        const record = buildSemanticMetadata({
            subtypeKey: "apply_patch",
            subtypeGroup: "file_ops",
            toolFamily: "file",
            operation: "patch",
        });
        expect(record["subtypeLabel"]).toBe("Apply Patch");
    });

    it("omits undefined optional fields", () => {
        const record = buildSemanticMetadata({
            subtypeKey: "read_file",
            subtypeLabel: "Read file",
            subtypeGroup: "files",
            toolFamily: "explore",
            operation: "read",
        });
        expect(record).not.toHaveProperty("entityType");
        expect(record).not.toHaveProperty("entityName");
        expect(record).not.toHaveProperty("importance");
    });
});

describe("deriveSemanticMetadata", () => {
    it("returns null for kinds without semantic coverage", () => {
        expect(deriveSemanticMetadata({ kind: "session.ended" })).toBeNull();
        expect(deriveSemanticMetadata({ kind: "plan.logged" })).toBeNull();
    });

    it("derives from terminal.command", () => {
        const result = deriveSemanticMetadata({
            kind: "terminal.command",
            command: "npm test",
        });
        expect(result?.subtypeKey).toBe("run_test");
    });

    it("routes file-mutation tool.used to file semantics", () => {
        const result = deriveSemanticMetadata({
            kind: "tool.used",
            toolName: "Edit",
            filePaths: ["packages/app/main.ts"],
        });
        expect(result?.subtypeKey).toBe("modify_file");
        expect(result?.entityName).toBe("packages/app/main.ts");
    });

    it("prefers metadata.relPath over filePaths for entityName", () => {
        const result = deriveSemanticMetadata({
            kind: "tool.used",
            toolName: "Write",
            filePaths: ["/abs/proj/packages/app/new.ts"],
            metadata: { relPath: "packages/app/new.ts" },
        });
        expect(result?.entityName).toBe("packages/app/new.ts");
    });

    it("routes non-mutation tool.used to explore semantics", () => {
        const result = deriveSemanticMetadata({
            kind: "tool.used",
            toolName: "Read",
            filePaths: ["src/a.ts"],
        });
        expect(result?.subtypeKey).toBe("read_file");
    });

    it("surfaces webUrls[0] as entityName for WebFetch", () => {
        const result = deriveSemanticMetadata({
            kind: "tool.used",
            toolName: "WebFetch",
            metadata: { webUrls: ["https://example.com/page"] },
        });
        expect(result?.subtypeKey).toBe("web_fetch");
        expect(result?.entityName).toBe("https://example.com/page");
    });

    it("routes agent.activity.logged mcp_call to inferMcpSemantic", () => {
        const result = deriveSemanticMetadata({
            kind: "agent.activity.logged",
            activityType: "mcp_call",
            mcpServer: "context7",
            mcpTool: "query-docs",
            toolName: "mcp__context7__query-docs",
        });
        expect(result?.subtypeKey).toBe("mcp_call");
        expect(result?.sourceTool).toBe("mcp__context7__query-docs");
    });

    it("routes skill_use activity to inferSkillSemantic", () => {
        const result = deriveSemanticMetadata({
            kind: "agent.activity.logged",
            activityType: "skill_use",
            skillName: "writing-plans",
        });
        expect(result?.subtypeKey).toBe("skill_use");
        expect(result?.entityName).toBe("writing-plans");
    });

    it("routes delegation activity to inferAgentSemantic", () => {
        const result = deriveSemanticMetadata({
            kind: "agent.activity.logged",
            activityType: "delegation",
            agentName: "general-purpose",
        });
        expect(result?.subtypeKey).toBe("delegation");
        expect(result?.entityName).toBe("general-purpose");
    });
});
