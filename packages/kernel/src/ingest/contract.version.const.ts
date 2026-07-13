/** 데몬 계약 버전을 알 수 없을 때 쓰는 값이며, 형식이 어긋나 항상 미지원으로 판정된다. */
export const UNKNOWN_CONTRACT_VERSION = "unknown";

/** 이 서버 릴리스가 요구하는 최소 데몬 계약 버전이다. */
export const MIN_SUPPORTED_CONTRACT_VERSION = "0.5.0";

function parseSemverTuple(version: string): readonly [number, number, number] | null {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** 계약 버전이 최소 지원 버전 이상인지 major.minor.patch로만 비교한다. */
export function isContractVersionSupported(
    version: string,
    minVersion: string = MIN_SUPPORTED_CONTRACT_VERSION,
): boolean {
    const actual = parseSemverTuple(version);
    const min = parseSemverTuple(minVersion);
    if (!actual || !min) return false;
    for (let i = 0; i < 3; i++) {
        if (actual[i]! > min[i]!) return true;
        if (actual[i]! < min[i]!) return false;
    }
    return true;
}

/** 데몬이 dead-letter 사유로 그대로 기록하는, 사람이 읽을 수 있는 거부 사유다. */
export function contractVersionRejectionReason(
    version: string,
    minVersion: string = MIN_SUPPORTED_CONTRACT_VERSION,
): string {
    return `contract version ${version || UNKNOWN_CONTRACT_VERSION} unsupported — plugin ${minVersion}+ required`;
}
