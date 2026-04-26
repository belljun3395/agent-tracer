import notifier from "node-notifier";
import type { IOsNotifier } from "~application/notifications/index.js";

export class NodeNotifierAdapter implements IOsNotifier {
    notify(args: {
        readonly title: string;
        readonly message: string;
        readonly onOpen?: () => void;
    }): Promise<void> {
        try {
            notifier.notify({
                title: args.title,
                message: args.message,
                wait: Boolean(args.onOpen),
                timeout: 10,
            }, (err, response) => {
                if (err) {
                    // Desktop notifications must never disrupt ingestion or
                    // verification, so we swallow the error after logging it
                    // — the dashboard badge is the fallback surface.
                    console.warn("[notifier] notify callback failed", err);
                    return;
                }
                if (args.onOpen && response === "activate") args.onOpen();
            });
        } catch (err) {
            console.warn("[notifier] notify threw synchronously", err);
        }
        return Promise.resolve();
    }
}
