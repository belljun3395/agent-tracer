const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_LENGTH = 26;

const DECODE = new Map<string, number>();
for (let i = 0; i < ENCODING.length; i++) DECODE.set(ENCODING[i]!, i);

const FNV_OFFSET_BASIS = 0x6c62272e07bb014262b821756295c58dn;
const FNV_PRIME = 0x0000000001000000000000000000013bn;
const MASK_128 = (1n << 128n) - 1n;

function decodeUlid(value: string): Uint8Array | null {
    if (value.length !== ULID_LENGTH) return null;
    let bits = 0n;
    for (let i = 0; i < ULID_LENGTH; i++) {
        const digit = DECODE.get(value[i]!);
        if (digit === undefined) return null;
        if (i === 0 && digit > 7) return null;
        bits = (bits << 5n) | BigInt(digit);
    }
    return toBytes(bits & MASK_128, 16);
}

function fnv1a128(value: string): bigint {
    let hash = FNV_OFFSET_BASIS;
    const bytes = new TextEncoder().encode(value);
    for (const byte of bytes) {
        hash ^= BigInt(byte);
        hash = (hash * FNV_PRIME) & MASK_128;
    }
    return hash;
}

function toBytes(value: bigint, length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    let remaining = value;
    for (let i = length - 1; i >= 0; i--) {
        bytes[i] = Number(remaining & 0xffn);
        remaining >>= 8n;
    }
    return bytes;
}

function toHex(bytes: Uint8Array): string {
    let output = "";
    for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
    return output;
}

function isZero(bytes: Uint8Array): boolean {
    return bytes.every((byte) => byte === 0);
}

export function isUlid(value: string): boolean {
    return decodeUlid(value) !== null;
}

export function traceIdOf(correlationId: string): string {
    const decoded = decodeUlid(correlationId);
    const bytes = decoded !== null && !isZero(decoded) ? decoded : toBytes(fnv1a128(correlationId), 16);
    return toHex(bytes);
}

export function spanIdOf(eventId: string): string {
    const decoded = decodeUlid(eventId);
    const source = decoded !== null ? decoded.subarray(8, 16) : toBytes(fnv1a128(eventId), 16).subarray(8, 16);
    if (isZero(source)) return toHex(toBytes(fnv1a128(eventId), 16).subarray(8, 16));
    return toHex(source);
}
