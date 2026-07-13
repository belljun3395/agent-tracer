import { FileAffinityRepository } from "@monitor/tracer-domain";
import { ListFileAffinityUseCase } from "~tracer-api/domain/affinity/application/query/list.file.affinity.usecase.js";
import { FileAffinityController } from "~tracer-api/domain/affinity/inbound/file.affinity.controller.js";
import { FILE_AFFINITY_REPOSITORY } from "~tracer-api/domain/affinity/port/file.affinity.repository.port.js";

/** affinity 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const affinityFeature = {
    controllers: [FileAffinityController],
    providers: [
        ListFileAffinityUseCase,
        { provide: FILE_AFFINITY_REPOSITORY, useExisting: FileAffinityRepository },
    ],
};
