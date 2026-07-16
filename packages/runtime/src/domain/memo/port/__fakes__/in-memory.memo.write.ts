import type {MemoWriteInput, MemoWritePort} from "~runtime/domain/memo/port/memo.write.port.js";

export class InMemoryMemoWrite implements MemoWritePort {
    readonly created: MemoWriteInput[] = [];
    private shouldFail = false;

    /** 서버 쓰기가 실패하는 상황을 재현한다. */
    failNext(): void {
        this.shouldFail = true;
    }

    async create(input: MemoWriteInput): Promise<boolean> {
        if (this.shouldFail) throw new Error("create failed");
        this.created.push(input);
        return true;
    }
}
