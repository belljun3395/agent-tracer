import type {
    CommandRedirect,
    CommandSequencePart,
    CommandTarget,
} from "~runtime/domain/ingest/model/command.analysis.model.js";

interface ShellState {
    quote: "'" | "\"" | null;
    escaped: boolean;
    parenDepth: number;
}

/** 셸 명령을 `&&`와 `||`와 `;`로 갈라 순서 있는 조각으로 만든다. */
export function splitSequence(command: string): readonly CommandSequencePart[] {
    const parts: CommandSequencePart[] = [];
    let current = "";
    let pendingOperator: CommandSequencePart["operatorFromPrevious"];
    const state: ShellState = {quote: null, escaped: false, parenDepth: 0};

    for (let index = 0; index < command.length; index += 1) {
        const char = command[index] ?? "";
        const next = command[index + 1] ?? "";
        updateShellState(state, char);

        if (!state.quote && state.parenDepth === 0 && command[index - 1] !== "\\") {
            const operator = char === "&" && next === "&" ? "&&"
                : char === "|" && next === "|" ? "||"
                    : char === ";" ? ";"
                        : char === "\n" ? ";"
                            : null;
            if (operator) {
                pushSequencePart(parts, current, pendingOperator);
                current = "";
                pendingOperator = operator;
                if (char !== "\n" && operator !== ";") index += 1;
                continue;
            }
        }
        current += char;
    }
    pushSequencePart(parts, current, pendingOperator);
    return parts;
}

export function splitPipeline(command: string): readonly string[] {
    const parts: string[] = [];
    let current = "";
    const state: ShellState = {quote: null, escaped: false, parenDepth: 0};

    for (let index = 0; index < command.length; index += 1) {
        const char = command[index] ?? "";
        const next = command[index + 1] ?? "";
        updateShellState(state, char);
        if (!state.quote && state.parenDepth === 0 && char === "|" && next !== "|" && command[index - 1] !== "\\") {
            const trimmed = current.trim();
            if (trimmed) parts.push(trimmed);
            current = "";
            continue;
        }
        current += char;
    }
    const trimmed = current.trim();
    if (trimmed) parts.push(trimmed);
    return parts;
}

export function tokenizeShell(command: string): readonly string[] {
    const tokens: string[] = [];
    let current = "";
    let quote: "'" | "\"" | null = null;
    let escaped = false;

    for (const char of command) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === "\\") {
            escaped = true;
            continue;
        }
        if (quote) {
            if (char === quote) quote = null;
            else current += char;
            continue;
        }
        if (char === "'" || char === "\"") {
            quote = char;
            continue;
        }
        if (/\s/.test(char)) {
            if (current) {
                tokens.push(current);
                current = "";
            }
            continue;
        }
        current += char;
    }
    if (current) tokens.push(current);
    return tokens;
}

export function extractRedirects(
    tokens: readonly string[],
): {readonly tokens: readonly string[]; readonly redirects: readonly CommandRedirect[]} {
    const cleanTokens: string[] = [];
    const redirects: CommandRedirect[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index] ?? "";
        const next = tokens[index + 1];
        const attached = token.match(/^(2>>|2>|>>|>|<|&>)(.+)$/);
        if (attached) {
            const value = attached[2] ?? "";
            if (value) redirects.push({operator: attached[1] ?? token, target: redirectTarget(value)});
            continue;
        }
        if (isRedirectOperator(token)) {
            if (next && !isRedirectOperator(next)) {
                redirects.push({operator: token, target: redirectTarget(next)});
                index += 1;
            }
            continue;
        }
        cleanTokens.push(token);
    }
    return {tokens: cleanTokens, redirects};
}

export function isEnvAssignment(token: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function redirectTarget(value: string): CommandTarget {
    if (/^&\d*-?$/.test(value)) return {type: "stream", value};
    const devices = ["/dev/null", "/dev/stdin", "/dev/stdout", "/dev/stderr", "/dev/tty"];
    if (devices.includes(value)) return {type: "stream", value};
    return {type: "file", value};
}

function updateShellState(state: ShellState, char: string): void {
    if (state.escaped) {
        state.escaped = false;
        return;
    }
    if (char === "\\") {
        state.escaped = true;
        return;
    }
    if (state.quote) {
        if (char === state.quote) state.quote = null;
        return;
    }
    if (char === "'" || char === "\"") {
        state.quote = char;
        return;
    }
    if (char === "(") state.parenDepth += 1;
    if (char === ")" && state.parenDepth > 0) state.parenDepth -= 1;
}

function pushSequencePart(
    parts: CommandSequencePart[],
    raw: string,
    operatorFromPrevious: CommandSequencePart["operatorFromPrevious"],
): void {
    const trimmed = raw.trim();
    if (!trimmed) return;
    parts.push({raw: trimmed, ...(operatorFromPrevious ? {operatorFromPrevious} : {})});
}

function isRedirectOperator(token: string): boolean {
    return ["<", ">", ">>", "2>", "2>>", "&>"].includes(token);
}
