import { MemoRepository, TransactionRunner } from "@monitor/tracer-domain";
import { SystemClock } from "@monitor/platform";
import { CreateMemoUseCase } from "~tracer-api/domain/memo/application/command/create.memo.usecase.js";
import { DeleteMemoUseCase } from "~tracer-api/domain/memo/application/command/delete.memo.usecase.js";
import { UpdateMemoUseCase } from "~tracer-api/domain/memo/application/command/update.memo.usecase.js";
import { GetMemosByTaskUseCase } from "~tracer-api/domain/memo/application/query/get.memos.by.task.usecase.js";
import { ListMemosUseCase } from "~tracer-api/domain/memo/application/query/list.memos.usecase.js";
import { MemoController } from "~tracer-api/domain/memo/inbound/memo.controller.js";
import { CLOCK } from "~tracer-api/domain/memo/port/clock.port.js";
import { MEMO_REPOSITORY } from "~tracer-api/domain/memo/port/memo.repository.port.js";
import { MEMO_TRANSACTION } from "~tracer-api/domain/memo/port/memo.transaction.port.js";

/** memo 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const memoFeature = {
    controllers: [MemoController],
    providers: [
        ListMemosUseCase,
        GetMemosByTaskUseCase,
        CreateMemoUseCase,
        UpdateMemoUseCase,
        DeleteMemoUseCase,
        { provide: CLOCK, useClass: SystemClock },
        { provide: MEMO_REPOSITORY, useExisting: MemoRepository },
        { provide: MEMO_TRANSACTION, useExisting: TransactionRunner },
    ],
};
