import { Module } from "@nestjs/common";
import { BookmarkWriteController } from "~adapters/http/ingest/index.js";
import { BookmarkController } from "~adapters/http/query/index.js";
import { ApplicationModule } from "../application/application.module.js";

@Module({
    imports: [ApplicationModule],
    controllers: [
        BookmarkController,
        BookmarkWriteController,
    ],
})
export class BookmarksHttpModule {}
