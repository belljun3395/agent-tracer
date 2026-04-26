import {
    isAllEventSubtypeKey,
    SUBTYPE_REGISTRY,
} from "../common/subtype.registry.js";
import type { AllEventSubtypeKey } from "../common/type/subtype.registry.type.js";
import {
    isKnownEventSubtypeGroup,
    isKnownEventToolFamily,
} from "~domain/runtime/event.subtype.keys.js";
import type { EventSubtypeGroup } from "~domain/runtime/type/event.subtype.keys.type.js";
import { isCoordinationLane, isExplorationLane, isImplementationLane } from "./event.predicates.js";
import { META } from "~domain/runtime/const/metadata.keys.const.js";
import { readString } from "./event.metadata.js";
import type { EventSemanticMetadata, EventSemanticSummary } from "./model/event.semantic.model.js";
import type { TimelineEvent } from "./model/timeline.event.model.js";

export function resolveSemanticView(event: TimelineEvent): EventSemanticSummary | undefined {
    const semantic = resolveSemanticFromMetadata(event.metadata) ?? inferSemanticFromLegacyEvent(event);
    if (!semantic) {
        return undefined;
    }
    return {
        subtypeKey: semantic.subtypeKey,
        subtypeLabel: semantic.subtypeLabel ?? SUBTYPE_REGISTRY[semantic.subtypeKey].label,
        subtypeGroup: semantic.subtypeGroup,
        ...(semantic.entityType ? { entityType: semantic.entityType } : {}),
        ...(semantic.entityName ? { entityName: semantic.entityName } : {}),
    };
}

function resolveSemanticFromMetadata(metadata: Record<string, unknown>): EventSemanticMetadata | undefined {
    const subtypeKey = readString(metadata, META.subtypeKey);
    if (!subtypeKey || !isAllEventSubtypeKey(subtypeKey)) {
        return undefined;
    }
    const entityType = readString(metadata, META.entityType);
    const entityName = readString(metadata, META.entityName);
    const sourceTool = readString(metadata, META.sourceTool);

    return {
        subtypeKey,
        subtypeLabel: readString(metadata, META.subtypeLabel) ?? SUBTYPE_REGISTRY[subtypeKey].label,
        subtypeGroup: normalizeSubtypeGroup(readString(metadata, META.subtypeGroup), subtypeKey),
        toolFamily: normalizeToolFamily(readString(metadata, META.toolFamily), subtypeKey),
        operation: readString(metadata, META.operation) ?? "observe",
        ...(entityType ? { entityType } : {}),
        ...(entityName ? { entityName } : {}),
        ...(sourceTool ? { sourceTool } : {}),
    };
}

function inferSemanticFromLegacyEvent(event: TimelineEvent): EventSemanticMetadata | undefined {
    const inferredKey = inferLegacySubtypeKey(event);
    if (!inferredKey) {
        return undefined;
    }
    const entityType = readString(event.metadata, META.entityType);
    const entityName = readString(event.metadata, META.entityName);
    const entry = SUBTYPE_REGISTRY[inferredKey];
    return {
        subtypeKey: inferredKey,
        subtypeLabel: entry.label,
        subtypeGroup: entry.group,
        toolFamily: entry.toolFamily,
        operation: entry.operation,
        ...(entityType ? { entityType } : {}),
        ...(entityName ? { entityName } : {}),
    };
}

function inferLegacySubtypeKey(event: TimelineEvent): AllEventSubtypeKey | null {
    const toolName = readString(event.metadata, META.toolName);
    const command = readString(event.metadata, META.command);
    const activityType = readString(event.metadata, META.activityType);
    const candidate = [toolName, command, activityType, event.title].find((value) => value && value.length > 0);
    const normalized = normalizeCandidate(candidate);
    if (!normalized) {
        return null;
    }
    if (isCoordinationLane(event.lane) && activityType && isAllEventSubtypeKey(activityType)) {
        return activityType;
    }
    if (isExplorationLane(event.lane)) {
        if (normalized.includes("websearch")) return "web_search";
        if (normalized.includes("fetch") || normalized.includes("browse")) return "web_fetch";
        if (normalized.includes("read") || normalized.includes("open") || normalized.includes("view")) return "read_file";
        if (normalized.includes("glob")) return "glob_files";
        if (normalized.includes("grep") || normalized.includes("search")) return "grep_code";
        if (normalized.includes("list") || normalized.includes("tree")) return "list_files";
        if (normalized.includes("bash") || normalized.includes("shell") || normalized.includes("command")) return "shell_probe";
    }
    if (isImplementationLane(event.lane)) {
        if (normalized.includes("patch")) return "apply_patch";
        if (normalized.includes("rename") || normalized.includes("move")) return "rename_file";
        if (normalized.includes("delete") || normalized.includes("remove")) return "delete_file";
        if (normalized.includes("create") || normalized.includes("write")) return "create_file";
        if (normalized.includes("edit") || normalized.includes("modify") || normalized.includes("update")) return "modify_file";
        if (normalized.includes("test")) return "run_test";
        if (normalized.includes("build")) return "run_build";
        if (normalized.includes("lint") || normalized.includes("format")) return "run_lint";
        if (normalized.includes("verify") || normalized.includes("check")) return "verify";
        if (normalized.includes("rule") || normalized.includes("policy")) return "rule_check";
        if (normalized.includes("bash") || normalized.includes("command")) return "run_command";
    }
    return null;
}

function normalizeSubtypeGroup(group: string | undefined, subtypeKey: AllEventSubtypeKey): EventSubtypeGroup {
    if (isKnownEventSubtypeGroup(group)) {
        return group;
    }
    return SUBTYPE_REGISTRY[subtypeKey].group;
}

function normalizeToolFamily(value: string | undefined, subtypeKey: AllEventSubtypeKey): EventSemanticMetadata["toolFamily"] {
    if (isKnownEventToolFamily(value)) {
        return value;
    }
    return SUBTYPE_REGISTRY[subtypeKey].toolFamily;
}

function normalizeCandidate(value: string | null | undefined): string {
    return (value ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}
