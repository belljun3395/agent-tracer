import type { RuntimeBindingRecordPortDto } from "~application/ports/runtime-bindings/dto/runtime.binding.record.port.dto.js";
import type { RuntimeBindingUpsertPortDto } from "~application/ports/runtime-bindings/dto/runtime.binding.upsert.port.dto.js";
import type { RuntimeBindingReadPort } from "~application/ports/runtime-bindings/runtime.binding.read.port.js";
import type { RuntimeBindingWritePort } from "~application/ports/runtime-bindings/runtime.binding.write.port.js";

export type RuntimeBinding = RuntimeBindingRecordPortDto;
export type RuntimeBindingUpsertInput = RuntimeBindingUpsertPortDto;

export interface IRuntimeBindingRepository extends RuntimeBindingReadPort, RuntimeBindingWritePort {}
