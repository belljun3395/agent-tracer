/** 에이전트가 스스로 남기는 메모이며 taskId는 데몬이 활성 바인딩으로 채운다. */
export interface MemoWriteInput {
    readonly taskId: string;
    readonly eventId?: string;
    readonly body: string;
}

export interface MemoWritePort {
    create(input: MemoWriteInput): Promise<boolean>;
}
