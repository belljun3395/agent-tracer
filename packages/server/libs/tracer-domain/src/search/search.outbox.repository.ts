import type { Repository } from "typeorm";
import type { SearchOutboxEntity } from "./search.outbox.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class SearchOutboxRepository {
    constructor(private readonly repo: Repository<SearchOutboxEntity>) {}

    // 도메인 쓰기와 같은 트랜잭션에서 불리며, 같은 대상이 두 번 적재돼도 배출은 멱등하다.
    async enqueue(row: SearchOutboxEntity): Promise<void> {
        await upsertByKeys(this.repo, row, ["id"]);
    }

    // 오래된 것부터 배출해 인덱스가 도메인 순서를 따라간다.
    async findBatch(limit: number): Promise<SearchOutboxEntity[]> {
        return this.repo.find({ order: { createdAt: "ASC" }, take: limit });
    }

    async delete(id: string): Promise<void> {
        await this.repo.delete({ id });
    }

    // 실패한 행은 남겨 다음 배출에서 다시 시도하며 사유를 남겨 무한 재시도를 관측할 수 있게 한다.
    async markFailed(id: string, attempts: number, error: string): Promise<void> {
        await this.repo.update({ id }, { attempts, lastError: error });
    }
}
