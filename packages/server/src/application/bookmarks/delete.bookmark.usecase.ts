import type { IBookmarkRepository, INotificationPublisher } from "~application/ports/index.js";
import type { DeleteBookmarkUseCaseIn, DeleteBookmarkUseCaseOut } from "./dto/delete.bookmark.usecase.dto.js";

export class DeleteBookmarkUseCase {
    constructor(
        private readonly bookmarkRepo: IBookmarkRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: DeleteBookmarkUseCaseIn): Promise<DeleteBookmarkUseCaseOut> {
        const bookmark = await this.bookmarkRepo.findById(input.bookmarkId);
        if (!bookmark) return { status: "not_found" };
        await this.bookmarkRepo.delete(input.bookmarkId);
        this.notifier.publish({ type: "bookmark.deleted", payload: { bookmarkId: input.bookmarkId } });
        return { status: "deleted" };
    }
}
