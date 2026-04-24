import { Module, type DynamicModule } from "@nestjs/common";
import { BookmarkWriteController } from "~adapters/http/ingest/index.js";
import { BookmarkController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        BookmarkController,
        BookmarkWriteController,
    ],
})
export class BookmarksHttpModule {
    static register(bookmarksApplicationModule: DynamicModule): DynamicModule {
        return {
            module: BookmarksHttpModule,
            imports: [bookmarksApplicationModule],
        };
    }
}
