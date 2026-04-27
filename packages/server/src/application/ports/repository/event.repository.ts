/**
 * Type-only re-exports used by legacy SQLite helpers (search + mapper).
 * IEventRepository class no longer exists; event module owns persistence
 * via TypeORM (see ~event/repository/) and exposes search via
 * EVENT_SEARCH_INDEX_PORT.
 */
import type { EventSearchOptionsPortDto } from "~application/ports/event-search/dto/event.search.query.port.dto.js";
import type {
    EventSearchEventHitPortDto,
    EventSearchResultsPortDto,
    EventSearchTaskHitPortDto,
} from "~application/ports/event-search/dto/event.search.result.port.dto.js";
import type { TimelineEventInsertPortDto } from "~application/ports/timeline-events/dto/timeline.event.insert.port.dto.js";

export type EventInsertInput = TimelineEventInsertPortDto;
export type SearchOptions = EventSearchOptionsPortDto;
export type SearchTaskHit = EventSearchTaskHitPortDto;
export type SearchEventHit = EventSearchEventHitPortDto;
export type SearchResults = EventSearchResultsPortDto;
