/** 원장의 멱등키가 될 시간순 정렬 가능한 식별자를 부를 때마다 새로 만든다. */
export interface IdGeneratorPort {
    next(): string;
}
