import { readdir } from "node:fs/promises";
import path from "node:path";

const ignoredBasenames = new Set([".DS_Store"]);

// Hook entry files and directories start with a capital letter (PreToolUse,
// PostToolUse/Bash). Helper files use a `_` prefix (`_shared.ts`) and helper
// directories use lowercase (`lib/`, `util/`); both are excluded from the
// bundle.
function isHookName(name: string): boolean {
    const first = name.charAt(0);
    return first >= "A" && first <= "Z";
}

export async function collectHookEntrypoints(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const result: string[] = [];

    for (const entry of entries) {
        if (ignoredBasenames.has(entry.name)) continue;
        if (entry.name.startsWith("_")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!isHookName(entry.name)) continue;
            result.push(...await collectHookEntrypoints(fullPath));
            continue;
        }

        if (!entry.isFile()) continue;
        if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
        if (!isHookName(entry.name)) continue;
        result.push(fullPath);
    }

    return result.sort();
}
