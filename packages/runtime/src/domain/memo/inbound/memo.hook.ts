import type {CreateMemoUsecase} from "~runtime/domain/memo/application/create.memo.usecase.js";
import type {SearchMemosInput, SearchMemosUsecase} from "~runtime/domain/memo/application/search.memos.usecase.js";
import type {MemoSearchResultItem} from "~runtime/domain/memo/port/memo.search.port.js";
import type {MemoWriteInput} from "~runtime/domain/memo/port/memo.write.port.js";

/** 메모 도메인이 어댑터에 제공하는 진입점 묶음이다. */
export interface MemoHook {
    readonly createMemo: CreateMemoUsecase;
    readonly searchMemos: SearchMemosUsecase;
}

export function onMemoCreateRequested(hook: MemoHook, input: MemoWriteInput): Promise<boolean> {
    return hook.createMemo.execute(input);
}

export function onMemoSearchRequested(hook: MemoHook, input: SearchMemosInput): Promise<readonly MemoSearchResultItem[]> {
    return hook.searchMemos.execute(input);
}
