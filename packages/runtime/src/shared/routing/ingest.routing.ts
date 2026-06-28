import { INGEST_ENDPOINTS, KIND } from "../events/kinds.const.js"
import type { IngestEndpoint, RuntimeIngestEventKind } from "../events/kinds.type.js"

// 각 그룹은 서버 ingest 엔드포인트가 수용하는 kind 집합과 일치해야 한다
// (packages/server/timeline-api/.../event.kind.const.ts). 어긋나면 해당 kind가 400으로 드롭된다.
export const TOOL_ACTIVITY_EVENT_KINDS = [KIND.toolUsed, KIND.terminalCommand, KIND.monitorObserved] as const;
export const WORKFLOW_EVENT_KINDS = [
    KIND.planLogged,
    KIND.actionLogged,
    KIND.verificationLogged,
    KIND.ruleLogged,
    KIND.thoughtLogged,
    KIND.contextSaved,
    KIND.contextSnapshot,
    KIND.userPromptExpansion,
    KIND.permissionRequest,
    KIND.worktreeCreate,
    KIND.worktreeRemove,
    KIND.setupTriggered,
    KIND.fileChanged,
] as const;
export const CONVERSATION_EVENT_KINDS = [KIND.userMessage, KIND.assistantResponse, KIND.questionLogged, KIND.todoLogged] as const;
export const COORDINATION_EVENT_KINDS = [KIND.agentActivityLogged] as const;
export const LIFECYCLE_EVENT_KINDS = [KIND.sessionEnded, KIND.instructionsLoaded] as const;
export const TELEMETRY_EVENT_KINDS = [KIND.tokenUsage] as const;
export const RUNTIME_INGEST_EVENT_KINDS = [
    ...TOOL_ACTIVITY_EVENT_KINDS, ...WORKFLOW_EVENT_KINDS, ...CONVERSATION_EVENT_KINDS,
    ...COORDINATION_EVENT_KINDS, ...LIFECYCLE_EVENT_KINDS, ...TELEMETRY_EVENT_KINDS,
] as const;

const TOOL_ACTIVITY_KIND_SET = new Set<string>(TOOL_ACTIVITY_EVENT_KINDS)
const WORKFLOW_KIND_SET = new Set<string>(WORKFLOW_EVENT_KINDS)
const CONVERSATION_KIND_SET = new Set<string>(CONVERSATION_EVENT_KINDS)
const COORDINATION_KIND_SET = new Set<string>(COORDINATION_EVENT_KINDS)
const LIFECYCLE_KIND_SET = new Set<string>(LIFECYCLE_EVENT_KINDS)
const TELEMETRY_KIND_SET = new Set<string>(TELEMETRY_EVENT_KINDS)

/** Matches an event kind against the six routing group sets and returns the corresponding `/ingest/v1/*` endpoint path. Defaults to the workflow endpoint for unrecognised kinds. */
export function resolveIngestEndpoint(kind: RuntimeIngestEventKind): IngestEndpoint {
    if (TOOL_ACTIVITY_KIND_SET.has(kind)) return INGEST_ENDPOINTS.toolActivity
    if (WORKFLOW_KIND_SET.has(kind)) return INGEST_ENDPOINTS.workflow
    if (CONVERSATION_KIND_SET.has(kind)) return INGEST_ENDPOINTS.conversation
    if (COORDINATION_KIND_SET.has(kind)) return INGEST_ENDPOINTS.coordination
    if (LIFECYCLE_KIND_SET.has(kind)) return INGEST_ENDPOINTS.lifecycle
    if (TELEMETRY_KIND_SET.has(kind)) return INGEST_ENDPOINTS.telemetry
    return INGEST_ENDPOINTS.workflow
}
