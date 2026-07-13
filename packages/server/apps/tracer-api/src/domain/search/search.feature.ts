import { SearchEventsUseCase } from "~tracer-api/domain/search/application/search.events.usecase.js";
import { SearchTasksUseCase } from "~tracer-api/domain/search/application/search.tasks.usecase.js";
import { SearchController } from "~tracer-api/domain/search/inbound/search.controller.js";
import { OpenSearchEventSearch } from "~tracer-api/domain/search/adapter/opensearch.event.search.js";
import { OpenSearchTaskQuery } from "~tracer-api/domain/search/adapter/opensearch.task.query.js";
import { EVENT_SEARCH } from "~tracer-api/domain/search/port/event.search.port.js";
import { TASK_SEARCH } from "~tracer-api/domain/search/port/task.search.port.js";

/** search 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const searchFeature = {
    controllers: [SearchController],
    providers: [
        SearchEventsUseCase,
        SearchTasksUseCase,
        OpenSearchEventSearch,
        { provide: EVENT_SEARCH, useExisting: OpenSearchEventSearch },
        OpenSearchTaskQuery,
        { provide: TASK_SEARCH, useExisting: OpenSearchTaskQuery },
    ],
};
