import type {
    ContentBlobRecordPortDto,
    ContentBlobStorePort,
    ContentBlobWritePortDto,
    DomainEventStorePort,
} from "../event-store/index.js";

export type ContentBlobWriteInput = ContentBlobWritePortDto;
export type ContentBlobRecord = ContentBlobRecordPortDto;

export interface IEventStore extends DomainEventStorePort, ContentBlobStorePort {}
