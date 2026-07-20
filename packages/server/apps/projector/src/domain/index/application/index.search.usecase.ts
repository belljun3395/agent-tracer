import { Inject, Injectable } from "@nestjs/common";
import {
    KIND,
    RUNNING_TASK_STATUS,
    RUN_EVENT_KINDS,
    TIMELINE_EVENT_KINDS,
    type TaskStatus,
} from "@monitor/kernel";
import { parseStoredEventPayload } from "@monitor/kernel/ingest/stored-event.schema.js";
import { resolveTaskStatusEffect } from "@monitor/tracer-domain";
import { extractEventFields } from "~projector/support/event.fields.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { logError } from "~projector/support/log.js";
import { EVENTS_INDEX, SEARCH_INDEX_DEFINITIONS, TASKS_INDEX } from "~projector/domain/index/model/search.index.definitions.js";
import {
    SEARCH_INDEX_WRITER,
    type SearchBulkOperation,
    type SearchIndexWriterPort,
} from "~projector/domain/index/port/search.index.writer.port.js";

const TIMELINE_KIND_SET = new Set<string>(TIMELINE_EVENT_KINDS);
const RUN_KIND_SET = new Set<string>(RUN_EVENT_KINDS);

function taskStatusForKind(record: LedgerRecord): TaskStatus | undefined {
    if (record.kind === KIND.sessionStarted) return RUNNING_TASK_STATUS;
    if (record.kind === KIND.sessionEnded) {
        const payload = parseStoredEventPayload(record.payload);
        const explicitStatus = payload.taskEffects?.taskStatus;
        const completeTask = payload.completeTask;
        const completionReason = payload.completionReason;
        return resolveTaskStatusEffect({
            kind: record.kind,
            ...(explicitStatus !== undefined ? { explicitStatus } : {}),
            ...(completeTask !== undefined ? { completeTask } : {}),
            ...(completionReason !== undefined ? { completionReason } : {}),
        });
    }
    return undefined;
}

function buildEventDoc(record: LedgerRecord): Record<string, unknown> {
    const fields = extractEventFields(record);
    const doc: Record<string, unknown> = {
        userId: record.userId,
        taskId: record.taskId,
        kind: record.kind,
        lane: fields.lane,
        title: fields.title,
        filePaths: fields.filePaths,
        seq: Number(record.seq),
        occurredAt: record.occurredAt.toISOString(),
    };
    if (record.sessionId !== null) doc["sessionId"] = record.sessionId;
    if (fields.body !== null) doc["body"] = fields.body;
    if (fields.toolName !== null) doc["toolName"] = fields.toolName;
    return doc;
}

function buildTaskDoc(record: LedgerRecord): Record<string, unknown> {
    const iso = record.occurredAt.toISOString();
    const doc: Record<string, unknown> = { userId: record.userId, updatedAt: iso, lastEventAt: iso };
    const payload = parseStoredEventPayload(record.payload);
    if (payload.title !== undefined) doc["title"] = payload.title;
    if (payload.workspacePath !== undefined) doc["workspacePath"] = payload.workspacePath;
    if (payload.taskKind !== undefined) doc["taskKind"] = payload.taskKind;
    if (payload.origin !== undefined) doc["origin"] = payload.origin;
    const status = taskStatusForKind(record);
    if (status !== undefined) doc["status"] = status;
    if (record.kind === KIND.sessionStarted) doc["createdAt"] = iso;
    return doc;
}

/** 원장 배치를 이벤트·태스크 검색 문서로 바꿔 색인한다. */
@Injectable()
export class IndexSearchUseCase {
    constructor(@Inject(SEARCH_INDEX_WRITER) private readonly searchIndex: SearchIndexWriterPort) {}

    async ensureIndices(): Promise<void> {
        for (const definition of SEARCH_INDEX_DEFINITIONS) {
            await this.searchIndex.ensureIndex(definition, true);
        }
    }

    async execute(records: readonly LedgerRecord[]): Promise<void> {
        const operations: SearchBulkOperation[] = [];
        for (const record of records) {
            if (TIMELINE_KIND_SET.has(record.kind)) {
                operations.push({
                    action: "index",
                    index: EVENTS_INDEX,
                    id: record.id,
                    document: buildEventDoc(record),
                });
            } else if (RUN_KIND_SET.has(record.kind)) {
                operations.push({
                    action: "update",
                    index: TASKS_INDEX,
                    id: record.taskId,
                    document: buildTaskDoc(record),
                    upsert: true,
                });
            }
        }
        if (operations.length === 0) return;

        const result = await this.searchIndex.writeBulk(operations);
        if (result.errors) {
            logError({ msg: "search.bulk.errors", items: result.itemCount, reason: result.firstErrorReason ?? null });
        }
    }
}
