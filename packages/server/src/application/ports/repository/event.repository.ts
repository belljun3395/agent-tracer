import type {
    EventSearchEventHitPortDto,
    EventSearchOptionsPortDto,
    EventSearchPort,
    EventSearchResultsPortDto,
    EventSearchTaskHitPortDto,
} from "../event-search/index.js";
import type {
    TimelineEventInsertPortDto,
    TimelineEventReadPort,
    TimelineEventWritePort,
} from "../timeline-events/index.js";

export type EventInsertInput = TimelineEventInsertPortDto;
export type SearchOptions = EventSearchOptionsPortDto;
export type SearchTaskHit = EventSearchTaskHitPortDto;
export type SearchEventHit = EventSearchEventHitPortDto;
export type SearchResults = EventSearchResultsPortDto;

export interface IEventRepository extends TimelineEventReadPort, TimelineEventWritePort, EventSearchPort {}
