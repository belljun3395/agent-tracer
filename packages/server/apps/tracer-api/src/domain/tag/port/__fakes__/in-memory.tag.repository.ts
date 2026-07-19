import type { TagEntity } from "@monitor/tracer-domain";
import type { TagRepositoryPort } from "~tracer-api/domain/tag/port/tag.repository.port.js";
import { cloneRow } from "./clone-row.js";

/** 태그 저장소 포트의 인메모리 대역이다. */
export class InMemoryTagRepository implements TagRepositoryPort {
    private rows = new Map<string, TagEntity>();

    seed(...tags: readonly TagEntity[]): void {
        for (const tag of tags) this.rows.set(tag.id, tag);
    }

    all(): TagEntity[] {
        return [...this.rows.values()].map(cloneRow);
    }

    snapshot(): Map<string, TagEntity> {
        return new Map([...this.rows].map(([id, row]) => [id, cloneRow(row)]));
    }

    restore(snapshot: Map<string, TagEntity>): void {
        this.rows = snapshot;
    }

    findById(id: string): Promise<TagEntity | null> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? null : cloneRow(row));
    }

    findByIds(userId: string, ids: readonly string[]): Promise<TagEntity[]> {
        const idSet = new Set(ids);
        return Promise.resolve(
            this.all().filter((tag) => tag.userId === userId && idSet.has(tag.id) && tag.deletedAt === null),
        );
    }

    findByName(userId: string, name: string): Promise<TagEntity | null> {
        const found = this.all().find((tag) => tag.userId === userId && tag.name === name && tag.deletedAt === null);
        return Promise.resolve(found ?? null);
    }

    listAll(userId: string): Promise<TagEntity[]> {
        const found = this.all()
            .filter((tag) => tag.userId === userId && tag.deletedAt === null)
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        return Promise.resolve(found);
    }

    upsert(tag: TagEntity): Promise<void> {
        this.rows.set(tag.id, cloneRow(tag));
        return Promise.resolve();
    }
}
