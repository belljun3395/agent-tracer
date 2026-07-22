import { NativeConnection, Worker } from "@temporalio/worker";

export type ChatActivityTable = Record<string, (...args: never[]) => Promise<unknown>>;

export interface ChatTemporalWorkerHandle {
    run(): Promise<void>;
    shutdown(): void;
    close(): Promise<void>;
}

/** tracer-api의 chat 활동만 소비하는 Temporal worker를 만든다. */
export async function createChatTemporalWorker(options: {
    readonly address: string;
    readonly namespace: string;
    readonly taskQueue: string;
    readonly activities: ChatActivityTable;
}): Promise<ChatTemporalWorkerHandle> {
    const connection = await NativeConnection.connect({ address: options.address });
    const workflowsPath = new URL(
        `../chat.workflows.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`,
        import.meta.url,
    ).pathname;
    const worker = await Worker.create({
        connection,
        namespace: options.namespace,
        taskQueue: options.taskQueue,
        workflowsPath,
        activities: options.activities,
        bundlerOptions: {
            webpackConfigHook: (config) => {
                config.resolve = {
                    ...config.resolve,
                    alias: {
                        ...config.resolve?.alias,
                        "~tracer-api": new URL("..", import.meta.url).pathname,
                    },
                };
                return config;
            },
        },
        shutdownGraceTime: "5 minutes",
        shutdownForceTime: "6 minutes",
    });
    return {
        run: () => worker.run(),
        shutdown: () => void worker.shutdown(),
        close: () => connection.close(),
    };
}
