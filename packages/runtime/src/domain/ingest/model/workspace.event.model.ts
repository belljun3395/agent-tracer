import * as path from "node:path";
import {
    KIND,
    LANE,
    provenEvidence,
    turnOf,
    type IngestTarget,
    type RuntimeIngestEvent,
} from "~runtime/domain/ingest/model/event.model.js";
import type {
    ActionLoggedMetadata,
    FileChangedMetadata,
    InstructionsLoadedMetadata,
    PermissionRequestMetadata,
    RuleLoggedMetadata,
    WorktreeMetadata,
} from "~runtime/domain/ingest/model/session.metadata.model.js";
import {sanitizeToolInput} from "~runtime/domain/ingest/model/tool.call.model.js";
import {relativeProjectPath} from "~runtime/domain/ingest/model/workspace.path.model.js";
import {truncate} from "~runtime/support/text.js";

const INPUT_SUMMARY_MAX = 400;

/** 지침 파일이 컨텍스트에 로드된 사실의 입력이다. */
export interface InstructionsLoadedInput {
    readonly projectDir: string;
    readonly filePath: string;
    readonly loadReason: string;
    readonly memoryType: string;
}

export function instructionsLoadedEvent(
    target: IngestTarget,
    input: InstructionsLoadedInput,
): RuntimeIngestEvent {
    const relPath = relativeProjectPath(input.projectDir, input.filePath);
    const fileName = path.basename(input.filePath);
    const metadata: InstructionsLoadedMetadata = {
        ...provenEvidence("Observed directly by the InstructionsLoaded hook."),
        filePath: input.filePath,
        relPath,
        loadReason: input.loadReason,
        memoryType: input.memoryType,
    };
    return {
        kind: KIND.instructionsLoaded,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.planning,
        title: input.loadReason === "compact"
            ? `Instructions reloaded: ${fileName}`
            : `Instructions loaded: ${fileName}`,
        body: relPath,
        metadata,
    };
}

/** 워크스페이스 파일이 디스크에서 바뀐 사실을 기록한다. */
export function fileChangedEvent(
    target: IngestTarget,
    projectDir: string,
    filePath: string,
): RuntimeIngestEvent {
    const relPath = relativeProjectPath(projectDir, filePath);
    const metadata: FileChangedMetadata = {
        ...provenEvidence("Observed directly by the FileChanged hook."),
        filePath,
        ...(relPath ? {relPath} : {}),
    };
    return {
        kind: KIND.fileChanged,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.background,
        title: `File changed: ${path.basename(relPath || filePath)}`,
        body: relPath || filePath,
        filePaths: [filePath],
        metadata,
    };
}

/** worktree 생성은 Claude Code가 직접 하므로 관찰할 수 있는 것은 제거뿐이다. */
export function worktreeRemovedEvent(
    target: IngestTarget,
    projectDir: string,
    worktreePath: string,
): RuntimeIngestEvent {
    const relPath = relativeProjectPath(projectDir, worktreePath);
    const metadata: WorktreeMetadata = {
        ...provenEvidence("Observed directly by the WorktreeRemove hook."),
        worktreePath,
        ...(relPath ? {relPath} : {}),
    };
    return {
        kind: KIND.worktreeRemove,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.background,
        title: `Worktree removed: ${path.basename(relPath || worktreePath)}`,
        body: relPath || worktreePath,
        metadata,
    };
}

/** 사용자 권한 다이얼로그가 뜬 도구 호출의 입력이다. */
export interface PermissionRequestInput {
    readonly toolName: string;
    readonly toolInput: Record<string, unknown>;
    readonly toolUseId?: string;
    readonly suggestionCount: number;
}

export function permissionRequestEvent(
    target: IngestTarget,
    input: PermissionRequestInput,
): RuntimeIngestEvent {
    const summary = summarizeToolInput(input.toolInput);
    const metadata: PermissionRequestMetadata = {
        ...provenEvidence("Observed directly by the PermissionRequest hook."),
        toolName: input.toolName,
        ...(input.toolUseId !== undefined ? {toolUseId: input.toolUseId} : {}),
        ...(summary ? {toolInputSummary: summary} : {}),
        suggestionCount: input.suggestionCount,
    };
    return {
        kind: KIND.permissionRequest,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.coordination,
        title: `Permission requested: ${input.toolName}`,
        ...(summary ? {body: summary} : {}),
        metadata,
    };
}

/** 자동 모드 분류기가 도구 호출을 거부한 사실을 규칙 이벤트로 만든다. */
export function permissionDeniedEvent(
    target: IngestTarget,
    toolName: string,
    toolInput: Record<string, unknown>,
    toolUseId?: string,
): RuntimeIngestEvent {
    const metadata: RuleLoggedMetadata = {
        ...provenEvidence("Emitted by the PermissionDenied hook."),
        ruleStatus: "denied",
        ruleOutcome: "auto_deny",
        rulePolicy: "auto_mode_classifier",
        ...(toolUseId !== undefined ? {toolUseId} : {}),
    };
    return {
        kind: KIND.ruleLogged,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.rule,
        title: `Permission denied: ${toolName}`,
        body: `Auto-mode denied ${toolName}: ${summarizeToolInput(toolInput)}`,
        metadata,
    };
}

/** 부모 태스크에 남기는 서브에이전트 수명주기 입력이다. */
export interface SubagentLifecycleInput {
    readonly agentId: string;
    readonly agentType: string;
    readonly parentSessionId: string;
    readonly childTaskId?: string;
    readonly lastMessage?: string;
}

export function subagentStartedEvent(
    target: IngestTarget,
    input: SubagentLifecycleInput,
): RuntimeIngestEvent {
    const metadata: ActionLoggedMetadata = {
        ...provenEvidence("Emitted by the SubagentStart hook."),
        asyncTaskId: input.agentId,
        asyncStatus: "running",
        agentId: input.agentId,
        agentType: input.agentType,
        parentTaskId: target.taskId,
        parentSessionId: input.parentSessionId,
        ...(input.childTaskId !== undefined ? {childTaskId: input.childTaskId} : {}),
    };
    return {
        kind: KIND.actionLogged,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.background,
        title: `Subagent started: ${input.agentType}`,
        metadata,
    };
}

export function subagentFinishedEvent(
    target: IngestTarget,
    input: SubagentLifecycleInput,
): RuntimeIngestEvent {
    const metadata: ActionLoggedMetadata = {
        ...provenEvidence("Emitted by the SubagentStop hook."),
        asyncTaskId: input.agentId,
        asyncStatus: "completed",
        agentId: input.agentId,
        agentType: input.agentType,
        parentTaskId: target.taskId,
        parentSessionId: input.parentSessionId,
    };
    return {
        kind: KIND.actionLogged,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.background,
        title: `Subagent finished: ${input.agentType}`,
        ...(input.lastMessage ? {body: input.lastMessage} : {}),
        metadata,
    };
}

function summarizeToolInput(toolInput: Record<string, unknown>): string {
    return truncate(JSON.stringify(sanitizeToolInput(toolInput)), INPUT_SUMMARY_MAX);
}
