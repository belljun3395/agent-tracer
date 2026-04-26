import type { EventSearchOptionsPortDto } from "~application/ports/event-search/dto/event.search.query.port.dto.js";
import type { EventSearchEventHitPortDto, EventSearchResultsPortDto, EventSearchTaskHitPortDto } from "~application/ports/event-search/dto/event.search.result.port.dto.js";
import type { EventSearchPort } from "~application/ports/event-search/event.search.port.js";
import type { TimelineEventInsertPortDto } from "~application/ports/timeline-events/dto/timeline.event.insert.port.dto.js";
import type { TimelineEventReadPort } from "~application/ports/timeline-events/timeline.event.read.port.js";
import type { TimelineEventWritePort } from "~application/ports/timeline-events/timeline.event.write.port.js";

export type EventInsertInput = TimelineEventInsertPortDto;
export type SearchOptions = EventSearchOptionsPortDto;
export type SearchTaskHit = EventSearchTaskHitPortDto;
export type SearchEventHit = EventSearchEventHitPortDto;
export type SearchResults = EventSearchResultsPortDto;

export interface IEventRepository extends TimelineEventReadPort, TimelineEventWritePort, EventSearchPort {}
