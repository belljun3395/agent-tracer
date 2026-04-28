import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Content-addressable blob storage. Blobs are deduplicated by their sha256
 * digest. Used to store large attachments (e.g. tool output, prompt text)
 * referenced from event payloads via the digest.
 */
@Entity({ name: "content_blobs" })
export class ContentBlobEntity {
    @PrimaryColumn({ name: "sha256", type: "text" })
    sha256!: string;

    @Column({ name: "byte_size", type: "integer" })
    byteSize!: number;

    @Column({ type: "text", nullable: true })
    mime!: string | null;

    @Column({ name: "created_at", type: "integer" })
    createdAt!: number;

    @Column({ type: "blob" })
    body!: Buffer;
}
