import type {MemoWriteInput, MemoWritePort} from "~runtime/domain/memo/port/memo.write.port.js";

/** 서버가 잠깐 죽어도 도구 호출이 예외로 튀지 않도록 쓰기 실패를 흡수한다. */
export class CreateMemoUsecase {
    constructor(private readonly writer: MemoWritePort) {}

    async execute(input: MemoWriteInput): Promise<boolean> {
        if (input.taskId === "" || input.body.trim() === "") return false;
        try {
            return await this.writer.create(input);
        } catch {
            return false;
        }
    }
}
