import type { Client } from "@opensearch-project/opensearch";
import type { SearchIndexDefinition } from "~projector/domain/index/model/search.index.definitions.js";
import type { SearchIndexAdminPort } from "~projector/domain/index/port/search.index.admin.port.js";
import type { SearchIndexRetentionPort } from "~projector/domain/index/port/search.index.retention.port.js";
import type {
    SearchBulkOperation,
    SearchIndexWriterPort,
} from "~projector/domain/index/port/search.index.writer.port.js";
import type { ReadinessProbe } from "~projector/support/health.server.js";
import { errorMessage, logError } from "~projector/support/log.js";

function isAlreadyExists(error: unknown): boolean {
    return error instanceof Error && error.message.includes("resource_already_exists");
}

function isNotFound(error: unknown): boolean {
    return typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 404;
}

interface BulkErrorItem {
    readonly error?: { readonly type: string; readonly reason?: string };
}

// 개별 문서 오류를 전부 로그로 반복하지 않도록 벌크 응답에서 첫 실패 사유만 뽑는다.
function firstBulkErrorReason(items: readonly Record<string, BulkErrorItem>[]): string | undefined {
    for (const item of items) {
        for (const result of Object.values(item)) {
            if (result.error !== undefined) return result.error.reason ?? result.error.type;
        }
    }
    return undefined;
}

function toBulkBody(operations: readonly SearchBulkOperation[]): Record<string, unknown>[] {
    const body: Record<string, unknown>[] = [];
    for (const operation of operations) {
        if (operation.action === "index") {
            body.push(
                { index: { _index: operation.index, _id: operation.id } },
                operation.document,
            );
            continue;
        }
        body.push(
            { update: { _index: operation.index, _id: operation.id } },
            { doc: operation.document, doc_as_upsert: operation.upsert },
        );
    }
    return body;
}

/** OpenSearch SDK를 애플리케이션 검색 포트에 맞추는 어댑터다. */
export class OpenSearchIndexAdapter
implements SearchIndexWriterPort, SearchIndexAdminPort, SearchIndexRetentionPort, ReadinessProbe {
    constructor(private readonly client: Client) {}

    async ping(): Promise<void> {
        await this.client.cluster.health({ timeout: "1s" });
    }

    async ensureIndex(definition: SearchIndexDefinition, attachAlias: boolean): Promise<void> {
        let exists = false;
        try {
            exists = Boolean((await this.client.indices.exists({ index: definition.index })).body);
        } catch (error) {
            if (!isNotFound(error)) {
                logError({ msg: "search.index.exists.check_failed", index: definition.index, error: errorMessage(error) });
            }
            exists = false;
        }
        if (exists) return;
        try {
            await this.client.indices.create({
                index: definition.index,
                body: {
                    settings: definition.settings,
                    ...(attachAlias ? { aliases: { [definition.alias]: {} } } : {}),
                    mappings: definition.mappings,
                },
            });
        } catch (error) {
            if (!isAlreadyExists(error)) throw error;
        }
    }

    async writeBulk(
        operations: readonly SearchBulkOperation[],
    ): Promise<{ errors: boolean; itemCount: number; firstErrorReason?: string }> {
        const response = await this.client.bulk({ body: toBulkBody(operations), refresh: false });
        return {
            errors: response.body.errors,
            itemCount: response.body.items.length,
            ...(response.body.errors
                ? { firstErrorReason: firstBulkErrorReason(response.body.items) ?? "unknown" }
                : {}),
        };
    }

    async deleteBefore(index: string, field: string, cutoff: Date): Promise<number> {
        const response = await this.client.deleteByQuery({
            index,
            body: { query: { range: { [field]: { lt: cutoff.toISOString() } } } },
            refresh: true,
        });
        return "deleted" in response.body ? response.body.deleted : 0;
    }

    async indexDocument(index: string, id: string, document: Record<string, unknown>): Promise<void> {
        await this.client.index({ index, id, body: document, refresh: false });
    }

    async updateDocument(index: string, id: string, document: Record<string, unknown>): Promise<void> {
        await this.client.update({ index, id, body: { doc: document, doc_as_upsert: true } });
    }

    async deleteDocument(index: string, id: string): Promise<void> {
        try {
            await this.client.delete({ index, id });
        } catch (error) {
            if (!isNotFound(error)) throw error;
        }
    }

    async resolveAlias(alias: string): Promise<readonly string[]> {
        try {
            const response = await this.client.indices.getAlias({ name: alias });
            return Object.keys(response.body);
        } catch (error) {
            // 연결 실패를 별칭 없음으로 읽으면 별칭 교체가 거짓 위에서 돈다.
            if (!isNotFound(error)) throw error;
            return [];
        }
    }

    async reindex(sourceIndex: string, targetIndex: string): Promise<void> {
        await this.client.reindex({
            body: { source: { index: sourceIndex }, dest: { index: targetIndex } },
            wait_for_completion: true,
            refresh: true,
        });
    }

    async count(index: string): Promise<number> {
        const response = await this.client.count({ index });
        return response.body.count;
    }

    async swapAlias(alias: string, sourceIndex: string, targetIndex: string): Promise<void> {
        await this.client.indices.updateAliases({
            body: {
                actions: [
                    { remove: { index: sourceIndex, alias } },
                    { add: { index: targetIndex, alias } },
                ],
            },
        });
    }
}
