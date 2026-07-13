import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

type JsonValidator<T> = (value: unknown) => value is T;

/** 검증에 실패하거나 읽을 수 없는 JSON 파일은 null로 취급한다. */
export function readJsonFile<T>(filePath: string, validate: JsonValidator<T>): T | null {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
        return validate(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** 임시 파일에 쓰고 rename해 중간에 죽어도 기존 파일이 깨지지 않게 한다. */
export function writeJsonFile(filePath: string, value: unknown, spacing?: number): void {
    const directory = path.dirname(filePath);
    const tempFilePath = path.join(
        directory,
        `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
    );
    try {
        fs.mkdirSync(directory, {recursive: true});
        fs.writeFileSync(tempFilePath, JSON.stringify(value, null, spacing));
        fs.renameSync(tempFilePath, filePath);
    } catch {
        try {
            fs.unlinkSync(tempFilePath);
        } catch {
            return;
        }
    }
}

/** 없는 파일을 지워도 실패로 보지 않는다. */
export function deleteJsonFile(filePath: string): void {
    try {
        fs.unlinkSync(filePath);
    } catch {
        return;
    }
}
