import type { FileAffinityEntity } from "@monitor/tracer-domain";

export const FILE_AFFINITY_REPOSITORY = Symbol("FileAffinityRepository");

/** 의도별 파일 친화도 집계의 조회를 제공하는 애플리케이션 포트다. */
export interface FileAffinityRepositoryPort {
    findByIntent(intentLabel: string, limit: number): Promise<FileAffinityEntity[]>;
}
