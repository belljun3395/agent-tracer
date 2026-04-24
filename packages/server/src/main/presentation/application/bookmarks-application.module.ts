import { Module } from "@nestjs/common";
import { BOOKMARKS_APPLICATION_EXPORTS, BOOKMARKS_APPLICATION_PROVIDERS } from "./bookmarks.providers.js";

@Module({
    providers: BOOKMARKS_APPLICATION_PROVIDERS,
    exports: [...BOOKMARKS_APPLICATION_EXPORTS],
})
export class BookmarksApplicationModule {}
