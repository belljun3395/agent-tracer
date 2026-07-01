import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const ENCRYPTED_PREFIX = "enc:v1:";
// Only used when MONITOR_PROFILE isn't "prd" and no real key was configured,
// so local dev works out of the box without leaving prod unprotected.
const INSECURE_LOCAL_DEV_KEY = "monitor-local-dev-insecure-default-key";

function resolveKey(): Buffer {
    const secret = process.env["MONITOR_SETTINGS_ENCRYPTION_KEY"];
    if (!secret) {
        if (process.env["MONITOR_PROFILE"] === "prd") {
            throw new Error(
                "MONITOR_SETTINGS_ENCRYPTION_KEY must be set in the prd profile to store sensitive settings.",
            );
        }
        return createHash("sha256").update(INSECURE_LOCAL_DEV_KEY, "utf8").digest();
    }
    return createHash("sha256").update(secret, "utf8").digest();
}

/** Envelope-encrypts a sensitive setting value for storage in app_settings.value. */
export function encryptSettingValue(plaintext: string): string {
    const key = resolveKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/** Decrypts a value produced by encryptSettingValue. */
export function decryptSettingValue(stored: string): string {
    if (!stored.startsWith(ENCRYPTED_PREFIX)) {
        throw new Error("Setting value is not in the expected encrypted format.");
    }
    const parts = stored.slice(ENCRYPTED_PREFIX.length).split(":");
    const [ivB64, authTagB64, ciphertextB64] = parts;
    if (parts.length !== 3 || !ivB64 || !authTagB64 || !ciphertextB64) {
        throw new Error("Malformed encrypted setting value.");
    }
    const key = resolveKey();
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextB64, "base64")),
        decipher.final(),
    ]);
    return plaintext.toString("utf8");
}
