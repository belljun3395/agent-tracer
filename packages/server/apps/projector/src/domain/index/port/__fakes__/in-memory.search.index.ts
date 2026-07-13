import type { SearchIndexDefinition } from "~projector/domain/index/model/search.index.definitions.js";
import type { SearchIndexAdminPort } from "~projector/domain/index/port/search.index.admin.port.js";
import type { SearchIndexRetentionPort } from "~projector/domain/index/port/search.index.retention.port.js";
import type {
    SearchBulkOperation,
    SearchIndexWriterPort,
} from "~projector/domain/index/port/search.index.writer.port.js";

/** 검색 인덱스 writer·admin·retention 포트의 인메모리 대역이다. */
export class InMemorySearchIndex implements SearchIndexWriterPort, SearchIndexAdminPort, SearchIndexRetentionPort {
    readonly bulks: SearchBulkOperation[][] = [];
    readonly createdIndices: string[] = [];
    readonly reindexCalls: { readonly source: string; readonly target: string }[] = [];
    readonly aliasSwaps: { readonly alias: string; readonly remove: string; readonly add: string }[] = [];
    readonly deletions: { readonly index: string; readonly field: string; readonly cutoff: Date }[] = [];
    indexFails = false;
    updateFails = false;
    reindexLimit: number | null = null;

    private readonly aliases = new Map<string, string[]>();
    private readonly indices = new Map<string, Map<string, Record<string, unknown>>>();

    seedAlias(alias: string, ...indices: readonly string[]): void {
        this.aliases.set(alias, [...indices]);
        for (const index of indices) this.ensureStore(index);
    }

    seedDocument(index: string, id: string, document: Record<string, unknown> = {}): void {
        this.ensureStore(index).set(id, document);
    }

    documentIds(index: string): readonly string[] {
        return [...this.ensureStore(index).keys()];
    }

    document(index: string, id: string): Record<string, unknown> | undefined {
        return this.ensureStore(index).get(id);
    }

    ensureIndex(definition: SearchIndexDefinition, attachAlias: boolean): Promise<void> {
        if (!this.indices.has(definition.index)) {
            this.ensureStore(definition.index);
            this.createdIndices.push(definition.index);
        }
        if (attachAlias) this.aliases.set(definition.alias, [definition.index]);
        return Promise.resolve();
    }

    writeBulk(
        operations: readonly SearchBulkOperation[],
    ): Promise<{ readonly errors: boolean; readonly itemCount: number }> {
        this.bulks.push([...operations]);
        for (const operation of operations) {
            const store = this.ensureStore(operation.index);
            const previous = operation.action === "update" ? store.get(operation.id) ?? {} : {};
            store.set(operation.id, { ...previous, ...operation.document });
        }
        return Promise.resolve({ errors: false, itemCount: operations.length });
    }

    indexDocument(index: string, id: string, document: Record<string, unknown>): Promise<void> {
        if (this.indexFails) return Promise.reject(new Error("opensearch down"));
        this.ensureStore(index).set(id, document);
        return Promise.resolve();
    }

    updateDocument(index: string, id: string, document: Record<string, unknown>): Promise<void> {
        if (this.updateFails) return Promise.reject(new Error("opensearch down"));
        const store = this.ensureStore(index);
        store.set(id, { ...store.get(id) ?? {}, ...document });
        return Promise.resolve();
    }

    resolveAlias(alias: string): Promise<readonly string[]> {
        return Promise.resolve([...this.aliases.get(alias) ?? []]);
    }

    reindex(sourceIndex: string, targetIndex: string): Promise<void> {
        this.reindexCalls.push({ source: sourceIndex, target: targetIndex });
        const source = [...this.ensureStore(sourceIndex).entries()];
        const copied = this.reindexLimit === null ? source : source.slice(0, this.reindexLimit);
        const target = this.ensureStore(targetIndex);
        for (const [id, document] of copied) target.set(id, document);
        return Promise.resolve();
    }

    count(index: string): Promise<number> {
        return Promise.resolve(this.ensureStore(index).size);
    }

    swapAlias(alias: string, sourceIndex: string, targetIndex: string): Promise<void> {
        this.aliasSwaps.push({ alias, remove: sourceIndex, add: targetIndex });
        const next = [...this.aliases.get(alias) ?? []].filter((index) => index !== sourceIndex);
        next.push(targetIndex);
        this.aliases.set(alias, next);
        return Promise.resolve();
    }

    deleteBefore(index: string, field: string, cutoff: Date): Promise<number> {
        this.deletions.push({ index, field, cutoff });
        const store = this.ensureStore(index);
        let deleted = 0;
        for (const [id, document] of [...store.entries()]) {
            const value = document[field];
            if (typeof value === "string" && new Date(value).getTime() < cutoff.getTime()) {
                store.delete(id);
                deleted += 1;
            }
        }
        return Promise.resolve(deleted);
    }

    private ensureStore(index: string): Map<string, Record<string, unknown>> {
        const store = this.indices.get(index);
        if (store !== undefined) return store;
        const created = new Map<string, Record<string, unknown>>();
        this.indices.set(index, created);
        return created;
    }
}
