import { randomBytes } from "node:crypto";

const TOKEN_INSTANCE_SEPARATOR = ".";

export function createCallbackToken(instanceId: string): string {
    const secret = randomBytes(24).toString("base64url");
    return `${encodeTokenInstanceId(instanceId)}${TOKEN_INSTANCE_SEPARATOR}${secret}`;
}

export function callbackRejectionReason(token: string, instanceId: string): string {
    const issuer = decodeTokenInstanceId(token);
    if (issuer !== null && issuer !== instanceId) {
        return `callback misrouted: token issued for instance "${issuer}", this instance is "${instanceId}"`;
    }
    return "unknown or expired callback token";
}

function encodeTokenInstanceId(instanceId: string): string {
    return Buffer.from(instanceId, "utf8").toString("base64url");
}

function decodeTokenInstanceId(token: string): string | null {
    const separatorIndex = token.indexOf(TOKEN_INSTANCE_SEPARATOR);
    if (separatorIndex <= 0) return null;
    try {
        return Buffer.from(token.slice(0, separatorIndex), "base64url").toString("utf8");
    } catch {
        return null;
    }
}
