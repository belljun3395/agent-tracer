import { Module, type DynamicModule } from "@nestjs/common";
import { BookmarkCommandController } from "~adapters/http/command/index.js";
import { BookmarkQueryController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        BookmarkCommandController,
        BookmarkQueryController,
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
