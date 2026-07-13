export interface KafkaReadinessProbe {
    ping(): Promise<void>;
}

interface KafkaAdminClient {
    connect(): Promise<void>;
    listTopics(): Promise<unknown>;
    disconnect(): Promise<void>;
}

interface KafkaAdminConfig {
    readonly kafkaJS: {readonly retry: {readonly retries: number}};
}

interface KafkaAdminFactory {
    admin(config?: KafkaAdminConfig): KafkaAdminClient;
}

export function createKafkaReadinessProbe(kafka: KafkaAdminFactory): KafkaReadinessProbe {
    return {
        async ping(): Promise<void> {
            const admin = kafka.admin({kafkaJS: {retry: {retries: 0}}});
            await admin.connect();
            try {
                await admin.listTopics();
            } finally {
                await admin.disconnect();
            }
        },
    };
}
