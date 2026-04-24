import { Module } from "@nestjs/common";
import { BookmarkWriteController } from "~adapters/http/ingest/index.js";
import { BookmarkController } from "~adapters/http/query/index.js";
import { BookmarksApplicationModule } from "../application/bookmarks-application.module.js";

@Module({
    imports: [BookmarksApplicationModule],
    controllers: [
        BookmarkController,
        BookmarkWriteController,
    ],
})
export class BookmarksHttpModule {}
