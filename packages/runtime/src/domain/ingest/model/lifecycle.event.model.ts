import {
    KIND,
    LANE,
    provenEvidence,
    turnOf,
    type IngestTarget,
    type RuntimeIngestEvent,
} from "~runtime/domain/ingest/model/event.model.js";
import type {
    ContextSavedMetadata,
    ContextSnapshotMetadata,
    SetupMetadata,
} from "~runtime/domain/ingest/model/session.metadata.model.js";

const SESSION_TRIGGER_TITLES: Record<string, string> = {
    startup: "Session started",
    resume: "Session resumed",
    clear: "Conversation cleared",
    compact: "Session resumed after compact",
};

const SESSION_TRIGGER_BODIES: Record<string, string> = {
    startup: "Claude Code session started.",
    resume: "Claude Code session resumed.",
    clear: "Claude Code conversation was cleared (/clear).",
    compact: "Claude Code session resumed after context compaction.",
};

function contextEvent(
    target: IngestTarget,
    title: string,
    body: string | undefined,
    metadata: ContextSavedMetadata,
): RuntimeIngestEvent {
    return {
        kind: KIND.contextSaved,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.planning,
        title,
        ...(body ? {body} : {}),
        metadata,
    };
}

/** 세션 시작 계기를 컨텍스트 이벤트로 만들고 모르는 계기는 기록하지 않는다. */
export function sessionTriggerEvent(target: IngestTarget, trigger: string): RuntimeIngestEvent | null {
    const title = SESSION_TRIGGER_TITLES[trigger];
    if (title === undefined) return null;
    return contextEvent(target, title, SESSION_TRIGGER_BODIES[trigger], {
        ...provenEvidence("Emitted by the SessionStart hook."),
        trigger,
    });
}

export function configChangedEvent(target: IngestTarget, source: string): RuntimeIngestEvent {
    return contextEvent(
        target,
        `Config changed: ${source}`,
        `Configuration source ${source} was updated during the session.`,
        {...provenEvidence("Emitted by the ConfigChange hook."), trigger: `config_change:${source}`},
    );
}

export function cwdChangedEvent(
    target: IngestTarget,
    oldCwd: string | undefined,
    newCwd: string | undefined,
): RuntimeIngestEvent {
    const body = oldCwd && newCwd
        ? `${oldCwd} → ${newCwd}`
        : newCwd
            ? `cwd set to ${newCwd}`
            : "cwd changed";
    return contextEvent(target, "Working directory changed", body, {
        ...provenEvidence("Emitted by the CwdChanged hook."),
        trigger: "cwd_changed",
    });
}

export function notificationEvent(
    target: IngestTarget,
    notificationType: string,
    message: string | undefined,
): RuntimeIngestEvent {
    return contextEvent(target, `Notification: ${notificationType}`, message, {
        ...provenEvidence("Emitted by the Notification hook."),
        trigger: `notification:${notificationType}`,
    });
}

/** 병렬 도구 배치의 fan-out 경계를 컨텍스트 이벤트로 만든다. */
export function toolBatchEvent(target: IngestTarget, toolNames: readonly string[]): RuntimeIngestEvent {
    const body = toolNames.length > 0
        ? `Tools: ${toolNames.join(", ")}`
        : `Batch of ${toolNames.length} tool calls`;
    return contextEvent(target, `Parallel tool batch (${toolNames.length})`, body, {
        ...provenEvidence("Emitted by the PostToolBatch hook."),
        trigger: "tool_batch_completed",
        itemCount: toolNames.length,
    });
}

export function compactStartedEvent(
    target: IngestTarget,
    trigger: string,
    customInstructions: string | undefined,
): RuntimeIngestEvent {
    return contextEvent(target, "Context compacting", customInstructions, {
        ...provenEvidence("Emitted by the PreCompact hook."),
        trigger,
        compactPhase: "before",
    });
}

export function compactFinishedEvent(
    target: IngestTarget,
    trigger: string,
    summary: string | undefined,
): RuntimeIngestEvent {
    return contextEvent(
        target,
        "Context compacted",
        summary || "Claude Code compacted the conversation history.",
        {...provenEvidence("Emitted by the PostCompact hook."), trigger, compactPhase: "after"},
    );
}

/** 셋업 호출을 기록한다. */
export function setupEvent(target: IngestTarget, trigger: string): RuntimeIngestEvent {
    const metadata: SetupMetadata = {
        ...provenEvidence("Observed directly by the Setup hook."),
        trigger,
    };
    return {
        kind: KIND.setupTriggered,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.planning,
        title: trigger === "maintenance" ? "Setup: maintenance" : "Setup: init",
        body: `Claude Code setup triggered (${trigger}).`,
        metadata,
    };
}

/** 상태 표시줄이 주기적으로 보고하는 컨텍스트 창과 사용량 스냅샷이다. */
export type ContextSnapshotInput = Omit<ContextSnapshotMetadata, "evidenceLevel" | "evidenceReason" | "tags">;

export function contextSnapshotEvent(
    target: IngestTarget,
    snapshot: ContextSnapshotInput,
): RuntimeIngestEvent {
    const usedPct = snapshot.contextWindowUsedPct;
    const metadata: ContextSnapshotMetadata = {
        ...provenEvidence("Captured by the Claude Code status line script."),
        ...snapshot,
    };
    return {
        kind: KIND.contextSnapshot,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.telemetry,
        title: usedPct !== undefined ? `Context ${Math.round(usedPct)}% used` : "Context snapshot",
        metadata,
    };
}
