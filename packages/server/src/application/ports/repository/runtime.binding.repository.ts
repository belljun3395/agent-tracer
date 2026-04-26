import type {
    RuntimeBindingReadPort,
    RuntimeBindingRecordPortDto,
    RuntimeBindingUpsertPortDto,
    RuntimeBindingWritePort,
} from "../runtime-bindings/index.js";

export type RuntimeBinding = RuntimeBindingRecordPortDto;
export type RuntimeBindingUpsertInput = RuntimeBindingUpsertPortDto;

export interface IRuntimeBindingRepository extends RuntimeBindingReadPort, RuntimeBindingWritePort {}
