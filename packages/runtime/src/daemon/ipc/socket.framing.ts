/** 데몬 소켓 계약은 개행으로 끝나는 JSON 한 줄이므로 클라이언트와 서버가 같은 프레이밍을 여기서 함께 쓴다. */
export function createLineFramer(): (chunk: Buffer) => string | null {
    let buffer = "";
    return (chunk) => {
        buffer += chunk.toString("utf8");
        const index = buffer.indexOf("\n");
        if (index === -1) return null;
        return buffer.slice(0, index).trim();
    };
}
