import { Inject, Injectable } from "@nestjs/common";
import { SEARCH_INDEX_DEFINITIONS } from "~projector/domain/index/model/search.index.definitions.js";
import { SEARCH_INDEX_ADMIN, type SearchIndexAdminPort } from "~projector/domain/index/port/search.index.admin.port.js";

export interface SearchReindexResult {
    readonly alias: string;
    readonly fromIndex: string;
    readonly toIndex: string;
    readonly migrated: boolean;
    readonly sourceCount?: number;
    readonly targetCount?: number;
}

/** 검색 alias를 최신 물리 인덱스로 전환한다. */
@Injectable()
export class SearchReindexUseCase {
    constructor(@Inject(SEARCH_INDEX_ADMIN) private readonly searchIndex: SearchIndexAdminPort) {}

    async execute(alias: string): Promise<SearchReindexResult> {
        const definition = SEARCH_INDEX_DEFINITIONS.find((entry) => entry.alias === alias);
        if (definition === undefined) throw new Error(`알 수 없는 alias: ${alias}`);

        const sourceIndex = await this.resolveCurrentIndex(alias);
        const targetIndex = definition.index;
        if (sourceIndex === targetIndex) {
            return { alias, fromIndex: sourceIndex, toIndex: targetIndex, migrated: false };
        }

        await this.searchIndex.ensureIndex(definition, false);
        await this.searchIndex.reindex(sourceIndex, targetIndex);

        const sourceCount = await this.count(sourceIndex);
        const targetCount = await this.count(targetIndex);
        if (targetCount < sourceCount) {
            throw new Error(
                `리인덱스 불일치: ${sourceIndex}=${sourceCount}건, ${targetIndex}=${targetCount}건. alias를 스왑하지 않는다`,
            );
        }

        await this.searchIndex.swapAlias(alias, sourceIndex, targetIndex);

        return { alias, fromIndex: sourceIndex, toIndex: targetIndex, migrated: true, sourceCount, targetCount };
    }

    private async resolveCurrentIndex(alias: string): Promise<string> {
        const indices = await this.searchIndex.resolveAlias(alias);
        if (indices.length === 0) {
            throw new Error(`alias ${alias}가 어떤 인덱스도 가리키지 않는다. ensureIndices를 먼저 실행하라`);
        }
        if (indices.length > 1) {
            throw new Error(`alias ${alias}가 인덱스 ${indices.length}개를 가리킨다: ${indices.join(", ")}. 수동 정리가 필요하다`);
        }
        return indices[0] as string;
    }

    private async count(index: string): Promise<number> {
        return this.searchIndex.count(index);
    }
}
