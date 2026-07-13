import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";

/** 서버가 잠깐 죽어도 훅이 옛 캐시로 계속 돌도록 갱신 실패를 흡수한다. */
export class RefreshRecipeCacheUsecase {
    constructor(private readonly cache: RecipeCachePort) {}

    async execute(): Promise<boolean> {
        try {
            return await this.cache.refresh();
        } catch {
            return false;
        }
    }
}
