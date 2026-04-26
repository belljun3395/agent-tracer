import type { ContentBlobStorePort } from "~application/ports/event-store/content.blob.store.port.js";
import type { DomainEventStorePort } from "~application/ports/event-store/domain.event.store.port.js";
import type { ContentBlobRecordPortDto, ContentBlobWritePortDto } from "~application/ports/event-store/dto/content.blob.port.dto.js";

export type ContentBlobWriteInput = ContentBlobWritePortDto;
export type ContentBlobRecord = ContentBlobRecordPortDto;

export interface IEventStore extends DomainEventStorePort, ContentBlobStorePort {}
