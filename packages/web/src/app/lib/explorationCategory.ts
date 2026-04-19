import type { TimelineEventRecord } from "../types.js";
export interface ExplorationCategory {
    readonly category: string;
    readonly icon: string;
}
interface ExplorationCategoryRule {
    readonly category: string;
    readonly icon: string;
    readonly patterns: readonly string[];
}
const EXPLORATION_CATEGORIES: readonly ExplorationCategoryRule[] = [
    { category: "search", icon: "🔍", patterns: ["search", "websearch", "web_search", "grep", "find", "glob"] },
    { category: "read", icon: "📄", patterns: ["read", "cat", "view", "open", "inspect"] },
    { category: "fetch", icon: "🌐", patterns: ["fetch", "curl", "http", "url", "browse", "navigate"] },
    { category: "shell", icon: "⚙️", patterns: ["bash", "shell", "run", "execute", "command", "terminal"] },
    { category: "list", icon: "📋", patterns: ["list", "ls", "dir", "tree", "scan"] },
];
function normalize(s: string): string {
    return s.toLowerCase().replace(/[_\-\s]/g, "");
}
function matchCategory(input: string): ExplorationCategory | null {
    const n = normalize(input);
    if (!n)
        return null;
    for (const rule of EXPLORATION_CATEGORIES) {
        for (const pattern of rule.patterns) {
            const p = normalize(pattern);
            if (n.includes(p) || p.includes(n)) {
                return { category: rule.category, icon: rule.icon };
            }
        }
    }
    return null;
}
export function resolveExplorationCategory(event: Pick<TimelineEventRecord, "metadata" | "title" | "classification">): ExplorationCategory | null {
    const toolName = event.metadata["toolName"];
    if (typeof toolName === "string" && toolName.length > 0) {
        const match = matchCategory(toolName);
        if (match)
            return match;
    }
    const colonIndex = event.title.indexOf(":");
    const titleKey = colonIndex === -1 ? event.title : event.title.slice(0, colonIndex);
    if (titleKey.trim().length > 0) {
        const match = matchCategory(titleKey.trim());
        if (match)
            return match;
    }
    const mcpToolTag = event.classification.tags.find(t => t.startsWith("mcp-tool:"));
    if (mcpToolTag) {
        const suffix = mcpToolTag.slice("mcp-tool:".length);
        const match = matchCategory(suffix);
        if (match)
            return match;
    }
    return null;
}
