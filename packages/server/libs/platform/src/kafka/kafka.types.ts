import type { KafkaJS } from "@confluentinc/kafka-javascript";

export type KafkaClient = KafkaJS.Kafka;
export type KafkaProducer = KafkaJS.Producer;
export type KafkaConsumer = KafkaJS.Consumer;
export type KafkaEachBatchPayload = KafkaJS.EachBatchPayload;
export type KafkaMessage = KafkaJS.KafkaMessage;
