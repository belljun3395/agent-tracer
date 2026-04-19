import type { IBookmarkRepository, INotificationPublisher } from "~application/ports/index.js";
import type { DeleteBookmarkUseCaseIn } from "./delete.bookmark.usecase.dto.js";

export class DeleteBookmarkUseCase {
    constructor(
        private readonly bookmarkRepo: IBookmarkRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: DeleteBookmarkUseCaseIn): Promise<"deleted" | "not_found"> {
        const all = await this.bookmarkRepo.findAll();
        if (!all.some((b) => b.id === input.bookmarkId)) return "not_found";
        await this.bookmarkRepo.delete(input.bookmarkId);
        this.notifier.publish({ type: "bookmark.deleted", payload: { bookmarkId: input.bookmarkId } });
        return "deleted";
    }
}
