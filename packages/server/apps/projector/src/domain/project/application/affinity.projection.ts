import { Injectable } from "@nestjs/common";
import { AGENT_TRACER_ATTR } from "@monitor/kernel";
import { parseStoredEventPayload } from "@monitor/kernel/ingest/stored-event.schema.js";
import { FileAffinityEntity, type FileAffinityRole } from "@monitor/tracer-domain";
import type { AffinityProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { readString } from "~projector/support/payload.read.js";

const READ_ROLE: FileAffinityRole = "read";
const WRITE_ROLE: FileAffinityRole = "write";
const BOTH_ROLE: FileAffinityRole = "both";

const WRITE_SUBTYPES = new Set<string>(["modify_file", "create_file", "delete_file", "rename_file", "apply_patch"]);

function deriveRole(metadata: Record<string, unknown>): FileAffinityRole {
    const operation = readString(metadata, AGENT_TRACER_ATTR.operation);
    if (operation === "read" || operation === "observe") return READ_ROLE;
    if (operation === "modify" || operation === "write") return WRITE_ROLE;
    const subtype = readString(metadata, AGENT_TRACER_ATTR.subtypeKey);
    if (subtype === "read_file") return READ_ROLE;
    if (subtype !== undefined && WRITE_SUBTYPES.has(subtype)) return WRITE_ROLE;
    return BOTH_ROLE;
}

/** 파일 변경 이벤트에서 파일별 사용 의도를 집계해 친화도 읽기 모델에 투영한다. */
@Injectable()
export class AffinityProjection {
    async project(repositories: AffinityProjectionRepositories, record: LedgerRecord): Promise<void> {
        const payload = parseStoredEventPayload(record.payload);
        const filePaths = payload.filePaths;
        if (filePaths.length === 0) return;

        const role = deriveRole(payload.metadata);
        const task = await repositories.tasks.findById(record.taskId);
        const intentLabel = task?.title ?? record.taskId;

        for (const filePath of filePaths) {
            // Kafka 재전달로 같은 이벤트가 다시 도착해도 어긋나지 않도록 원본 이벤트를 세어 재계산한다.
            const openCount = await repositories.countFileTouches(record.taskId, filePath);
            const summary = new FileAffinityEntity();
            summary.filePath = filePath;
            summary.intentLabel = intentLabel;
            summary.role = role;
            summary.openCount = openCount;
            summary.lastSeenAt = record.occurredAt;
            await repositories.affinities.upsert(summary);
        }
    }
}
