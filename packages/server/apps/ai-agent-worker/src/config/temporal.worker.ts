import { NativeConnection, Runtime, Worker } from "@temporalio/worker";
import { AI_GENERATE_QUEUE, AI_JOB_QUEUE, TEMPORAL_SDK_METRICS_PORT } from "~ai-agent-worker/support/task.queue.const.js";
import { logInfo } from "./log.js";

/** 활동 이름을 활동 구현에 잇는 등록표다. */
export type ActivityTable = Record<string, (...args: never[]) => Promise<unknown>>;

export interface TemporalWorkerOptions {
    readonly address: string;
    readonly namespace: string;
    /** 워크플로와 짧은 활동이 도는 메인 큐에 등록할 활동이다. */
    readonly lightActivities: ActivityTable;
    /** 긴 언어 모델 호출이 도는 전용 큐에 등록할 활동이다. */
    readonly generateActivities: ActivityTable;
}

export interface TemporalWorkerHandle {
    run(): Promise<void>;
    shutdown(): void;
    close(): Promise<void>;
}

/** 워크플로와 활동을 두 큐로 나눠 폴링하는 워커를 만든다. */
export async function createTemporalWorkers(options: TemporalWorkerOptions): Promise<TemporalWorkerHandle> {
    // Worker.create보다 먼저 설치해야 워커 SDK 지표가 수집된다.
    Runtime.install({
        telemetryOptions: {
            metrics: { prometheus: { bindAddress: `0.0.0.0:${TEMPORAL_SDK_METRICS_PORT}` } },
        },
    });

    const connection = await NativeConnection.connect({ address: options.address });
    const workflowsPath = new URL(
        `./workflows.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`,
        import.meta.url,
    ).pathname;

    const mainWorker = await Worker.create({
        connection,
        namespace: options.namespace,
        taskQueue: AI_JOB_QUEUE,
        workflowsPath,
        activities: options.lightActivities,
        // 워크플로 번들러는 자체 리졸버를 써서 tsconfig 별칭을 모르므로 여기서 알려준다.
        bundlerOptions: {
            webpackConfigHook: (config) => {
                config.resolve = {
                    ...config.resolve,
                    alias: {
                        ...config.resolve?.alias,
                        "~ai-agent-worker": new URL("..", import.meta.url).pathname,
                    },
                };
                return config;
            },
        },
    });

    // 최대 15분인 생성 활동이 짧은 활동의 슬롯을 굶기지 않도록 전용 큐에서 낮은 동시성으로 돈다.
    const generateWorker = await Worker.create({
        connection,
        namespace: options.namespace,
        taskQueue: AI_GENERATE_QUEUE,
        activities: options.generateActivities,
        maxConcurrentActivityTaskExecutions: 6,
        // 배포가 진행 중인 언어 모델 호출을 즉시 취소해 유료 결과를 버리지 않도록 유예를 준다.
        shutdownGraceTime: "5 minutes",
        shutdownForceTime: "6 minutes",
    });

    logInfo({
        msg: "ai-agent-worker.polling",
        address: options.address,
        queues: [AI_JOB_QUEUE, AI_GENERATE_QUEUE],
    });

    return {
        run: async () => {
            await Promise.all([mainWorker.run(), generateWorker.run()]);
        },
        shutdown: () => {
            void mainWorker.shutdown();
            void generateWorker.shutdown();
        },
        close: () => connection.close(),
    };
}
