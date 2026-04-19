import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

type JsonValidator<T> = (value: unknown) => value is T;

/**
 * Reads a JSON file from disk, runs the provided validator, and returns the typed
 * value. Returns `null` if the file does not exist, cannot be parsed, or fails
 * validation.
 */
export function readJsonFile<T>(filePath: string, validate: JsonValidator<T>): T | null {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(content) as unknown;
        return validate(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Serialises `value` to JSON and writes it atomically via a temp file + rename,
 * ensuring a crash during write cannot corrupt the existing file. Creates parent
 * directories if needed.
 */
export function writeJsonFile(filePath: string, value: unknown, spacing?: number): void {
    const directory = path.dirname(filePath);
    const tempFilePath = path.join(
        directory,
        `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`
    );

    try {
        fs.mkdirSync(directory, {recursive: true});
        fs.writeFileSync(tempFilePath, JSON.stringify(value, null, spacing));
        fs.renameSync(tempFilePath, filePath);
    } catch {
        try {
            fs.unlinkSync(tempFilePath);
        } catch {
            void 0;
        }
    }
}

/**
 * Deletes a JSON file. Silently succeeds if the file does not exist.
 */
export function deleteJsonFile(filePath: string): void {
    try {
        fs.unlinkSync(filePath);
    } catch {
        void 0;
    }
}
