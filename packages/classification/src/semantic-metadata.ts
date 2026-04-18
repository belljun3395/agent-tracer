/**
 * Semantic metadata derivation for ingested events.
 *
 * Produces `EventSemanticMetadata` (subtypeKey, subtypeLabel, subtypeGroup,
 * toolFamily, operation, entityType, entityName, sourceTool) for the events
 * whose kind/toolName/activityType combination carries a canonical subtype in
 * the shared event-semantic contract (`@monitor/domain`).
 *
 * Ported from the hook-plugin's `hooks/classification/*` modules so that this
 * logic runs server-side at ingest time instead of client-side in the plugin.
 * The plugin still sends these fields during phase 6b; phase 6c strips the
 * plugin pipeline and the server becomes authoritative.
 *
 * Coverage:
 *   terminal.command (Bash)            → inferCommandSemantic
 *   tool.used (Edit/Write/MultiEdit/…) → inferFileToolSemantic
 *   tool.used (Read/Glob/Grep/Web…)    → inferExploreSemantic
 *   agent.activity.logged:mcp_call     → inferMcpSemantic
 *   agent.activity.logged:skill_use    → inferSkillSemantic
 *   agent.activity.logged:delegation   → inferAgentSemantic
 */
import type { EventSemanticMetadata, TimelineLane } from "@monitor/domain";

/** Bash commands always classify into exploration or implementation. */
export type CommandLane = Extract<TimelineLane, "exploration" | "implementation">;

export interface CommandSemantic {
    readonly lane: CommandLane;
    readonly metadata: EventSemanticMetadata;
}

/**
 * Classifies a shell command into a semantic subtype (probe/test/lint/etc.).
 */
export function inferCommandSemantic(command: string): CommandSemantic {
    const normalized = command.trim().toLowerCase();
    const commandToken = firstCommandToken(command);
    const commandEntity = commandToken || "shell";

    if (
        /^(pwd|ls|tree|find|fd|rg|grep|cat|sed|head|tail|wc|stat|file|which|whereis)\b/.test(normalized) ||
        /^git\s+(status|diff|show|log)\b/.test(normalized) ||
        /^(npm|pnpm|yarn|bun)\s+(ls|list)\b/.test(normalized)
    ) {
        return {
            lane: "exploration",
            metadata: {
                subtypeKey: "shell_probe",
                subtypeLabel: "Shell probe",
                subtypeGroup: "shell",
                toolFamily: "terminal",
                operation: "probe",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    if (/\b(rule|policy|guard|constraint|conformance)\b/.test(normalized)) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "rule_check",
                subtypeLabel: "Rule check",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    if (
        /\b(pytest|vitest|jest|ava|mocha|phpunit|rspec)\b/.test(normalized) ||
        /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b/.test(normalized) ||
        /\b(go|cargo)\s+test\b/.test(normalized) ||
        /\bplaywright\s+test\b/.test(normalized) ||
        /\bcypress\s+run\b/.test(normalized)
    ) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "run_test",
                subtypeLabel: "Run test",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    if (
        /\b(eslint|stylelint|ruff|flake8|prettier|biome|oxlint)\b/.test(normalized) ||
        /\b(npm|pnpm|yarn|bun)\s+(run\s+)?lint\b/.test(normalized) ||
        /\b(cargo|go)\s+fmt\b/.test(normalized)
    ) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "run_lint",
                subtypeLabel: "Run lint",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    if (
        /\b(typecheck|type-check|check-types|verify|validate|doctor|audit)\b/.test(normalized) ||
        /\btsc\b.*\b--noemit\b/.test(normalized) ||
        /\bcargo\s+check\b/.test(normalized) ||
        /\bgo\s+vet\b/.test(normalized) ||
        /\bmypy\b/.test(normalized)
    ) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "verify",
                subtypeLabel: "Verify",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    if (
        /\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b/.test(normalized) ||
        /\b(next|vite|webpack|rollup)\s+build\b/.test(normalized) ||
        /\bcargo\s+build\b/.test(normalized) ||
        /\bgo\s+build\b/.test(normalized) ||
        /\bdocker\s+build\b/.test(normalized) ||
        /\btsc\b/.test(normalized)
    ) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "run_build",
                subtypeLabel: "Run build",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    return {
        lane: "implementation",
        metadata: {
            subtypeKey: "run_command",
            subtypeLabel: "Run command",
            subtypeGroup: "execution",
            toolFamily: "terminal",
            operation: "execute",
            entityType: "command",
            entityName: commandEntity,
            sourceTool: "Bash"
        }
    };
}

/**
 * Classifies a file-mutation tool name into apply_patch/rename/delete/create/modify.
 * `entityName` is typically a project-relative path resolved by the caller, since
 * the project root is a client-side concern.
 */
export function inferFileToolSemantic(toolName: string, entityName?: string): EventSemanticMetadata {
    const normalized = toolName.trim().toLowerCase();

    if (normalized.includes("patch")) {
        return baseFileSemantic("apply_patch", "Apply patch", "patch", toolName, entityName);
    }
    if (normalized.includes("rename") || normalized.includes("move")) {
        return baseFileSemantic("rename_file", "Rename file", "rename", toolName, entityName);
    }
    if (normalized.includes("delete") || normalized.includes("remove")) {
        return baseFileSemantic("delete_file", "Delete file", "delete", toolName, entityName);
    }
    if (normalized.includes("write") || normalized.includes("create")) {
        return baseFileSemantic("create_file", "Create file", "create", toolName, entityName);
    }
    return baseFileSemantic("modify_file", "Modify file", "modify", toolName, entityName);
}

/**
 * Classifies an explore tool (Read/Glob/Grep/WebFetch/WebSearch) into a semantic subtype.
 * `entityName` and `queryOrUrl` are resolved by the caller from the ingest payload.
 */
export function inferExploreSemantic(
    toolName: string,
    options: { readonly entityName?: string; readonly queryOrUrl?: string } = {}
): EventSemanticMetadata {
    const normalized = toolName.trim().toLowerCase();
    const { entityName, queryOrUrl } = options;

    if (normalized === "read" || normalized.includes("view") || normalized.includes("open")) {
        return {
            subtypeKey: "read_file",
            subtypeLabel: "Read file",
            subtypeGroup: "files",
            toolFamily: "explore",
            operation: "read",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }
    if (normalized.includes("glob")) {
        return {
            subtypeKey: "glob_files",
            subtypeLabel: "Glob files",
            subtypeGroup: "search",
            toolFamily: "explore",
            operation: "search",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }
    if (normalized.includes("grep")) {
        return {
            subtypeKey: "grep_code",
            subtypeLabel: "Grep code",
            subtypeGroup: "search",
            toolFamily: "explore",
            operation: "search",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }
    if (normalized.includes("webfetch")) {
        return {
            subtypeKey: "web_fetch",
            subtypeLabel: "Web fetch",
            subtypeGroup: "web",
            toolFamily: "explore",
            operation: "fetch",
            entityType: "url",
            ...(queryOrUrl ? { entityName: queryOrUrl } : {}),
            sourceTool: toolName
        };
    }
    if (normalized.includes("websearch")) {
        return {
            subtypeKey: "web_search",
            subtypeLabel: "Web search",
            subtypeGroup: "web",
            toolFamily: "explore",
            operation: "search",
            entityType: "query",
            ...(queryOrUrl ? { entityName: queryOrUrl } : {}),
            sourceTool: toolName
        };
    }
    return {
        subtypeKey: "list_files",
        subtypeLabel: "List files",
        subtypeGroup: "search",
        toolFamily: "explore",
        operation: "list",
        entityType: "file",
        ...(entityName ? { entityName } : {}),
        sourceTool: toolName
    };
}

/** Classifies an MCP tool invocation. */
export function inferMcpSemantic(mcpServer: string, mcpTool: string, sourceToolName?: string): EventSemanticMetadata {
    return {
        subtypeKey: "mcp_call",
        subtypeLabel: "MCP call",
        subtypeGroup: "coordination",
        toolFamily: "coordination",
        operation: "invoke",
        entityType: "mcp",
        entityName: `${mcpServer}/${mcpTool}`,
        sourceTool: sourceToolName ?? `mcp__${mcpServer}__${mcpTool}`
    };
}

/** Classifies a Skill invocation. */
export function inferSkillSemantic(skillName: string | undefined, sourceToolName: string = "Skill"): EventSemanticMetadata {
    return {
        subtypeKey: "skill_use",
        subtypeLabel: "Skill use",
        subtypeGroup: "coordination",
        toolFamily: "coordination",
        operation: "invoke",
        entityType: "skill",
        ...(skillName ? { entityName: skillName } : {}),
        sourceTool: sourceToolName
    };
}

/** Classifies an agent delegation. */
export function inferAgentSemantic(entityName: string | undefined, sourceToolName: string = "Agent"): EventSemanticMetadata {
    return {
        subtypeKey: "delegation",
        subtypeLabel: "Delegation",
        subtypeGroup: "coordination",
        toolFamily: "coordination",
        operation: "delegate",
        entityType: "agent",
        ...(entityName ? { entityName } : {}),
        sourceTool: sourceToolName
    };
}

/**
 * Flattens `EventSemanticMetadata` into a wire-format record by dropping
 * undefined optional fields and filling in a humanized default label when
 * `subtypeLabel` is absent.
 */
export function buildSemanticMetadata(input: EventSemanticMetadata): Record<string, unknown> {
    return {
        subtypeKey: input.subtypeKey,
        subtypeLabel: input.subtypeLabel ?? humanizeSubtypeKey(input.subtypeKey),
        subtypeGroup: input.subtypeGroup,
        toolFamily: input.toolFamily,
        operation: input.operation,
        ...(input.entityType ? { entityType: input.entityType } : {}),
        ...(input.entityName ? { entityName: input.entityName } : {}),
        ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
        ...(input.importance ? { importance: input.importance } : {})
    };
}

/**
 * Input for the `deriveSemanticMetadata` orchestrator — a subset of the
 * ingest wire contract carrying just what's needed for subtype inference.
 */
export interface DeriveSemanticInput {
    readonly kind: string;
    readonly toolName?: string;
    readonly command?: string;
    readonly filePaths?: readonly string[];
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly activityType?: string;
    readonly mcpServer?: string;
    readonly mcpTool?: string;
    readonly agentName?: string;
    readonly skillName?: string;
}

/**
 * Dispatches an ingest payload to the appropriate inferrer and returns the
 * resulting `EventSemanticMetadata`, or `null` if no subtype applies.
 */
export function deriveSemanticMetadata(input: DeriveSemanticInput): EventSemanticMetadata | null {
    if (input.kind === "terminal.command" && input.command) {
        return inferCommandSemantic(input.command).metadata;
    }

    if (input.kind === "tool.used" && input.toolName) {
        const toolName = input.toolName;
        const normalized = toolName.trim().toLowerCase();
        const entityName = resolveFileEntityName(input);

        // File-mutation tools route to file semantics.
        if (
            normalized.includes("patch") ||
            normalized.includes("rename") ||
            normalized.includes("move") ||
            normalized.includes("delete") ||
            normalized.includes("remove") ||
            normalized === "write" ||
            normalized === "edit" ||
            normalized === "multiedit"
        ) {
            return inferFileToolSemantic(toolName, entityName);
        }

        // Everything else under tool.used is treated as an explore tool.
        const queryOrUrl = resolveExploreQuery(input);
        return inferExploreSemantic(toolName, {
            ...(entityName ? { entityName } : {}),
            ...(queryOrUrl ? { queryOrUrl } : {})
        });
    }

    if (input.kind === "agent.activity.logged") {
        if (input.activityType === "mcp_call" && input.mcpServer && input.mcpTool) {
            return inferMcpSemantic(input.mcpServer, input.mcpTool, input.toolName);
        }
        if (input.activityType === "skill_use") {
            return inferSkillSemantic(input.skillName, input.toolName ?? "Skill");
        }
        if (input.activityType === "delegation") {
            return inferAgentSemantic(input.agentName, input.toolName ?? "Agent");
        }
    }

    return null;
}

// ---- helpers ---------------------------------------------------------------

function baseFileSemantic(
    subtypeKey: EventSemanticMetadata["subtypeKey"],
    subtypeLabel: string,
    operation: string,
    sourceTool: string,
    entityName: string | undefined
): EventSemanticMetadata {
    return {
        subtypeKey,
        subtypeLabel,
        subtypeGroup: "file_ops",
        toolFamily: "file",
        operation,
        entityType: "file",
        ...(entityName ? { entityName } : {}),
        sourceTool
    };
}

function firstCommandToken(command: string): string {
    const [first = ""] = command.trim().split(/\s+/, 1);
    return first.replace(/^['"]+|['"]+$/g, "");
}

function humanizeSubtypeKey(value: string): string {
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

/**
 * Resolves the entity name for file-touching tools. Plugin payloads carry both
 * absolute `filePaths` and a convenience `metadata.relPath`; the relPath is
 * preferred when available (project-root-relative is more readable in the UI).
 */
function resolveFileEntityName(input: DeriveSemanticInput): string | undefined {
    const relPath = readString(input.metadata, "relPath");
    if (relPath) return relPath;
    const filePath = readString(input.metadata, "filePath");
    if (filePath) return filePath;
    if (input.filePaths?.length) {
        return input.filePaths[0];
    }
    return undefined;
}

/**
 * Resolves the query/url for explore tools. Plugin payloads stash web queries
 * under `metadata.webUrls[0]`; read-through when present, else fall back to
 * any string-typed `metadata.url` or `metadata.query`.
 */
function resolveExploreQuery(input: DeriveSemanticInput): string | undefined {
    const webUrls = input.metadata?.["webUrls"];
    if (Array.isArray(webUrls) && typeof webUrls[0] === "string") {
        return webUrls[0];
    }
    return readString(input.metadata, "url") ?? readString(input.metadata, "query");
}

function readString(metadata: Readonly<Record<string, unknown>> | undefined, key: string): string | undefined {
    if (!metadata) return undefined;
    const value = metadata[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
