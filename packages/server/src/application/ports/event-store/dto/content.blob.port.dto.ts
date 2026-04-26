export interface ContentBlobWritePortDto {
    readonly body: Buffer;
    readonly mime?: string;
    readonly createdAt?: number;
}

export interface ContentBlobRecordPortDto {
    readonly sha256: string;
    readonly byteSize: number;
    readonly mime?: string;
    readonly createdAt: number;
    readonly body: Buffer;
}
