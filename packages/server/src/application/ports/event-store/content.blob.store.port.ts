import type { ContentBlobRecordPortDto, ContentBlobWritePortDto } from "./dto/content.blob.port.dto.js";

export interface ContentBlobStorePort {
    putContentBlob(input: ContentBlobWritePortDto): Promise<ContentBlobRecordPortDto>;
    getContentBlob(sha256: string): Promise<ContentBlobRecordPortDto | null>;
}
