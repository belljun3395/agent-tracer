import type { Client } from "@opensearch-project/opensearch";
import type { SearchIndexDefinition } from "~projector/domain/index/model/search.index.definitions.js";
import type { SearchIndexAdminPort } from "~projector/domain/index/port/search.index.admin.port.js";
import type { SearchIndexRetentionPort } from "~projector/domain/index/port/search.index.retention.port.js";
import type {
    SearchBulkOperation,
    SearchIndexWriterPort,
} from "~projector/domain/index/port/search.index.writer.port.js";
import type { ReadinessProbe } from "~projector/support/health.server.js";

function isAlreadyExists(error: unknown): boolean {
    return error instanceof Error && error.message.includes("resource_already_exists");
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
        } catch {
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

    async writeBulk(operations: readonly SearchBulkOperation[]): Promise<{ errors: boolean; itemCount: number }> {
        const response = await this.client.bulk({ body: toBulkBody(operations), refresh: false });
        return { errors: response.body.errors, itemCount: response.body.items.length };
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

    async resolveAlias(alias: string): Promise<readonly string[]> {
        const response = await this.client.indices.getAlias({ name: alias }).catch(() => null);
        return response === null ? [] : Object.keys(response.body);
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
