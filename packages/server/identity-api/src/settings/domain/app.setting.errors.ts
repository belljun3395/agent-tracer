export class UnsupportedSettingKeyError extends Error {
    constructor(public readonly key: string) {
        super(`Unsupported setting key: ${key}`);
        this.name = "UnsupportedSettingKeyError";
    }
}

export class InvalidSettingValueError extends Error {
    constructor(public readonly key: string, message: string) {
        super(message);
        this.name = "InvalidSettingValueError";
    }
}
