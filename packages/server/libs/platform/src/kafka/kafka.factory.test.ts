import {describe, expect, it, vi} from "vitest";
import {createKafkaConsumer} from "./kafka.factory.js";
import type {KafkaClient, KafkaConsumer} from "./kafka.types.js";

describe("createKafkaConsumer", () => {
    it("시작 위치와 배치 상한을 컨슈머 생성 설정에 전달한다", () => {
        const consumer = {} as KafkaConsumer;
        const consumerFactory = vi.fn(() => consumer);
        const kafka = {consumer: consumerFactory} as unknown as KafkaClient;

        const result = createKafkaConsumer(kafka, {
            groupId: "projector-db",
            fromBeginning: true,
            maxBatchSize: 100,
        });

        expect(result).toBe(consumer);
        expect(consumerFactory).toHaveBeenCalledWith({
            kafkaJS: {groupId: "projector-db", fromBeginning: true},
            "js.consumer.max.batch.size": 100,
        });
    });

    it("배치 상한을 생략하면 벤더 기본값을 유지한다", () => {
        const consumerFactory = vi.fn(() => ({}));
        const kafka = {consumer: consumerFactory} as unknown as KafkaClient;

        createKafkaConsumer(kafka, {groupId: "ws-instance", fromBeginning: false});

        expect(consumerFactory).toHaveBeenCalledWith({
            kafkaJS: {groupId: "ws-instance", fromBeginning: false},
        });
    });
});
