import type { FileAffinityEntity } from "@monitor/tracer-domain";
import type { FileAffinityRepositoryPort } from "~tracer-api/domain/affinity/port/file.affinity.repository.port.js";

/** 파일 친화도 포트의 인메모리 대역이다. */
export class InMemoryFileAffinityRepository implements FileAffinityRepositoryPort {
    private readonly rows: FileAffinityEntity[] = [];

    seed(...rows: readonly FileAffinityEntity[]): void {
        this.rows.push(...rows);
    }

    all(): readonly FileAffinityEntity[] {
        return [...this.rows];
    }

    findByIntent(intentLabel: string, limit: number): Promise<FileAffinityEntity[]> {
        const matched = this.rows
            .filter((row) => row.intentLabel === intentLabel)
            .sort((left, right) => right.openCount - left.openCount)
            .slice(0, limit);
        return Promise.resolve(matched);
    }
}
