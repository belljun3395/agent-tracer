import { describe, expect, it } from "vitest";
import { resolveExplorationCategory, type TimelineEvent } from "@monitor/web-domain";
function makeEvent(overrides: {
    metadata?: Record<string, unknown>;
    title?: string;
    tags?: readonly string[];
}): Pick<TimelineEvent, "metadata" | "title" | "classification"> {
    return {
        metadata: overrides.metadata ?? {},
        title: overrides.title ?? "",
        classification: {
            lane: "exploration",
            tags: overrides.tags ?? [],
            matches: []
        }
    };
}
describe("resolveExplorationCategory", () => {
    it("matches web_search toolName to search category", () => {
        const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "web_search" } }));
        expect(result).toEqual({ category: "search", icon: "🔍" });
    });
    it("matches WebSearch toolName (mixed case, no separator) to search category", () => {
        const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "WebSearch" } }));
        expect(result).toEqual({ category: "search", icon: "🔍" });
    });
    it("matches read_file toolName to read category", () => {
        const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "read_file" } }));
        expect(result).toEqual({ category: "read", icon: "📄" });
    });
    it("matches fetch toolName to fetch category", () => {
        const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "fetch" } }));
        expect(result).toEqual({ category: "fetch", icon: "🌐" });
    });
    it("matches bash toolName to shell category", () => {
        const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "bash" } }));
        expect(result).toEqual({ category: "shell", icon: "⚙️" });
    });
    it("matches list_files toolName to list category", () => {
        const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "list_files" } }));
        expect(result).toEqual({ category: "list", icon: "📋" });
    });
    it("matches 'WebSearch: Java latest' title to search category when no toolName", () => {
        const result = resolveExplorationCategory(makeEvent({ title: "WebSearch: Java latest versions" }));
        expect(result).toEqual({ category: "search", icon: "🔍" });
    });
    it("matches 'Read: package.json' title to read category when no toolName", () => {
        const result = resolveExplorationCategory(makeEvent({ title: "Read: package.json" }));
        expect(result).toEqual({ category: "read", icon: "📄" });
    });
    it("matches title with no colon using full title as key", () => {
        const result = resolveExplorationCategory(makeEvent({ title: "websearch" }));
        expect(result).toEqual({ category: "search", icon: "🔍" });
    });
    it("matches mcp-tool:websearch tag to search category", () => {
        const result = resolveExplorationCategory(makeEvent({ tags: ["mcp-tool:websearch"] }));
        expect(result).toEqual({ category: "search", icon: "🔍" });
    });
    it("matches mcp-tool:read_file tag to read category", () => {
        const result = resolveExplorationCategory(makeEvent({ tags: ["tool.used", "mcp-tool:read_file"] }));
        expect(result).toEqual({ category: "read", icon: "📄" });
    });
    it("toolName wins over title when both are present", () => {
        const result = resolveExplorationCategory(makeEvent({
            metadata: { toolName: "fetch" },
            title: "Read: some-url"
        }));
        expect(result).toEqual({ category: "fetch", icon: "🌐" });
    });
    it("first-match in array order wins when tool name contains patterns from multiple categories", () => {
        const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "read_list" } }));
        expect(result).toEqual({ category: "read", icon: "📄" });
    });
    it("returns null when nothing matches", () => {
        const result = resolveExplorationCategory(makeEvent({
            metadata: { toolName: "unknown_action_xyz" },
            title: "Doing something"
        }));
        expect(result).toBeNull();
    });
    it("returns null when metadata, title, and tags are all empty", () => {
        const result = resolveExplorationCategory(makeEvent({}));
        expect(result).toBeNull();
    });
    it("returns null when toolName is not a string", () => {
        const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: 42 } }));
        expect(result).toBeNull();
    });
});
