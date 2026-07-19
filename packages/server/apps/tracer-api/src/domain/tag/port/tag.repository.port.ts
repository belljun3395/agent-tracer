import type { TagEntity } from "@monitor/tracer-domain";

export const TAG_REPOSITORY = Symbol("TagRepository");

/** 태그 애그리게이트의 조회를 제공하는 애플리케이션 포트다. */
export interface TagRepositoryPort {
    findById(id: string): Promise<TagEntity | null>;
    findByIds(userId: string, ids: readonly string[]): Promise<TagEntity[]>;
    findByName(userId: string, name: string): Promise<TagEntity | null>;
    listAll(userId: string): Promise<TagEntity[]>;
    upsert(tag: TagEntity): Promise<void>;
}
