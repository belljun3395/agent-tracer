import { BadRequestException, Injectable } from "@nestjs/common";
import type { PipeTransform } from "@nestjs/common";
import {
    contractVersionRejectionReason,
    createApiErrorEnvelope,
    isContractVersionSupported,
    UNKNOWN_CONTRACT_VERSION,
} from "@monitor/kernel";
import { contractVersionFieldSchema } from "@monitor/kernel/ingest/contract.version.schema.js";

export const CONTRACT_VERSION_REJECTED_CODE = "ingest.contract_version_unsupported";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 본문 검증보다 먼저 실행돼 버전 불일치를 개별 이벤트 잡음 없이 하나의 사유로만 답한다.
@Injectable()
export class ContractVersionPipe implements PipeTransform<unknown, unknown> {
    transform(value: unknown): unknown {
        const raw = isRecord(value) ? value["contractVersion"] : undefined;
        const parsed = contractVersionFieldSchema.safeParse(raw);
        const version = parsed.success ? parsed.data : UNKNOWN_CONTRACT_VERSION;
        if (!isContractVersionSupported(version)) {
            throw new BadRequestException(
                createApiErrorEnvelope(CONTRACT_VERSION_REJECTED_CODE, contractVersionRejectionReason(version)),
            );
        }
        return value;
    }
}
