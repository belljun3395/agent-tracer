import {createHash, randomBytes, randomUUID} from "node:crypto";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(timeMs: number): string {
    let value = Math.floor(timeMs);
    let output = "";
    for (let index = 0; index < 10; index += 1) {
        output = ENCODING[value % 32]! + output;
        value = Math.floor(value / 32);
    }
    return output;
}

function encodeBytes(bytes: Uint8Array): string {
    let bits = 0;
    let bitLength = 0;
    let output = "";
    for (const byte of bytes) {
        bits = (bits << 8) | byte;
        bitLength += 8;
        while (bitLength >= 5) {
            output += ENCODING[(bits >> (bitLength - 5)) & 31]!;
            bitLength -= 5;
        }
    }
    return output;
}

/** 원장 이벤트의 멱등키로 쓰는 시간순 정렬 가능한 26자 ULID를 만든다. */
export function generateUlid(timeMs = Date.now()): string {
    return `${encodeTime(timeMs)}${encodeBytes(randomBytes(10)).slice(0, 16)}`;
}

/** 외부 런타임 식별자를 시간부가 0이고 random부가 80비트 해시인 결정적 ULID로 바꾼다. */
export function deterministicUlid(parts: readonly string[]): string {
    const digest = createHash("sha256").update(JSON.stringify(parts)).digest().subarray(0, 10);
    return `0000000000${encodeBytes(digest)}`;
}

/** 무작위 UUID로 런타임 메시지를 식별한다. */
export function createMessageId(): string {
    return randomUUID();
}
