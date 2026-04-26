import type { EventSearchOptionsPortDto } from "./dto/event.search.query.port.dto.js";
import type { EventSearchResultsPortDto } from "./dto/event.search.result.port.dto.js";

export interface EventSearchPort {
    search(query: string, opts?: EventSearchOptionsPortDto): Promise<EventSearchResultsPortDto>;
}
