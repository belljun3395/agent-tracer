export type CommandStructure = "simple" | "sequence" | "pipeline" | "compound"
export type CommandEffect = "read_only" | "execute_check" | "write" | "destructive" | "network" | "unknown"
export type CommandConfidence = "high" | "medium" | "low"

export interface CommandTarget {
    readonly type: "file" | "directory" | "path" | "workspace" | "stream" | "url" | "package" | "unknown"
    readonly value: string
}

export interface CommandSelectors {
    readonly lineRange?: string
    readonly pattern?: string
}

export interface CommandRedirect {
    readonly operator: string
    readonly target: CommandTarget
}

export interface CommandStep {
    readonly raw: string
    readonly commandName: string
    readonly subcommand?: string
    readonly operation: string
    readonly targets: readonly CommandTarget[]
    readonly effect: CommandEffect
    readonly confidence: CommandConfidence
    readonly operatorFromPrevious?: "&&" | "||" | ";"
    readonly selectors?: CommandSelectors
    readonly workspace?: string
    readonly scriptName?: string
    readonly failureMasked?: boolean
    readonly redirects?: readonly CommandRedirect[]
    readonly pipeline?: readonly CommandStep[]
}

export interface CommandAnalysis {
    readonly raw: string
    readonly structure: CommandStructure
    readonly overallEffect: CommandEffect
    readonly confidence: CommandConfidence
    readonly steps: readonly CommandStep[]
    readonly failureMasked?: boolean
}

interface SequencePart {
    readonly raw: string
    readonly operatorFromPrevious?: "&&" | "||" | ";"
}

interface ShellState {
    quote: "'" | "\"" | null
    escaped: boolean
    parenDepth: number
}

const READ_COMMANDS = new Set(["cat", "head", "tail", "wc", "stat", "file", "which", "whereis"])
const LIST_COMMANDS = new Set(["pwd", "ls", "tree"])
const SEARCH_COMMANDS = new Set(["rg", "grep", "fd", "find"])
const LIMIT_COMMANDS = new Set(["head", "tail", "wc"])
const DESTRUCTIVE_COMMANDS = new Set(["rm", "rmdir"])
const WRITE_COMMANDS = new Set(["mv", "cp", "chmod", "chown", "mkdir", "touch"])
const NETWORK_COMMANDS = new Set(["curl", "wget"])

export function analyzeCommand(command: string): CommandAnalysis {
    const raw = command.trim()
    if (!raw) {
        return {
            raw: command,
            structure: "simple",
            overallEffect: "unknown",
            confidence: "low",
            steps: [],
        }
    }

    const sequence = splitSequence(raw)
    const steps = sequence.map((part) => analyzeSequencePart(part))
    const failureMasked = detectFailureMasked(sequence)

    return {
        raw,
        structure: resolveStructure(sequence, steps),
        overallEffect: combineEffects(steps.map((step) => step.effect)),
        confidence: combineConfidence(steps.map((step) => step.confidence)),
        steps,
        ...(failureMasked ? { failureMasked } : {}),
    }
}

function analyzeSequencePart(part: SequencePart): CommandStep {
    const pipelineParts = splitPipeline(part.raw)
    if (pipelineParts.length > 1) {
        const pipeline = pipelineParts.map((rawStep) => analyzeSimpleCommand({
            raw: rawStep,
        }))
        const targets = uniqueTargets(pipeline.flatMap((step) => step.targets))
        return {
            raw: part.raw,
            commandName: pipeline[0]?.commandName ?? "pipeline",
            operation: "pipeline",
            targets,
            effect: combineEffects(pipeline.map((step) => step.effect)),
            confidence: combineConfidence(pipeline.map((step) => step.confidence)),
            ...(part.operatorFromPrevious ? { operatorFromPrevious: part.operatorFromPrevious } : {}),
            pipeline,
        }
    }
    return analyzeSimpleCommand(part)
}

function analyzeSimpleCommand(part: SequencePart): CommandStep {
    const tokens = tokenizeShell(part.raw)
    const { tokens: commandTokens, redirects } = extractRedirects(tokens)
    const usefulTokens = commandTokens.filter((token) => !isEnvAssignment(token))
    const commandName = usefulTokens[0] ?? "shell"
    const args = usefulTokens.slice(1)
    const base = buildBaseStep(part, commandName, redirects)

    if (commandName === "sed") return analyzeSed(base, args)
    if (commandName === "git") return analyzeGit(base, args)
    if (commandName === "npm" || commandName === "pnpm" || commandName === "yarn") return analyzePackageManager(base, args)
    if (commandName === "vitest") return withStep(base, { operation: "run_test", effect: "execute_check", confidence: "high" })
    if (commandName === "tsc") return withStep(base, { operation: "run_build", effect: "execute_check", confidence: "high" })
    if (commandName === "eslint") return withStep(base, { operation: "run_lint", effect: "execute_check", confidence: "high" })
    if (LIMIT_COMMANDS.has(commandName)) return analyzeStreamTransform(base, args)
    if (SEARCH_COMMANDS.has(commandName)) return analyzeSearch(base, args)
    if (READ_COMMANDS.has(commandName)) return analyzeRead(base, args)
    if (LIST_COMMANDS.has(commandName)) return analyzeList(base, args)
    if (DESTRUCTIVE_COMMANDS.has(commandName)) return withStep(base, { operation: "delete_file", effect: "destructive", targets: pathTargets(args), confidence: "medium" })
    if (WRITE_COMMANDS.has(commandName)) return withStep(base, { operation: "write_file", effect: "write", targets: pathTargets(args), confidence: "medium" })
    if (NETWORK_COMMANDS.has(commandName)) return withStep(base, { operation: "fetch_url", effect: "network", targets: urlTargets(args), confidence: "medium" })

    return withStep(base, {
        operation: "unknown",
        effect: redirects.some((redirect) => redirect.operator.includes(">")) ? "write" : "unknown",
        confidence: containsComplexShell(part.raw) ? "low" : "medium",
    })
}

function buildBaseStep(part: SequencePart, commandName: string, redirects: readonly CommandRedirect[]): CommandStep {
    return {
        raw: part.raw,
        commandName,
        operation: "unknown",
        targets: redirects.map((redirect) => redirect.target),
        effect: "unknown",
        confidence: containsComplexShell(part.raw) ? "low" : "medium",
        ...(part.operatorFromPrevious ? { operatorFromPrevious: part.operatorFromPrevious } : {}),
        ...(redirects.length > 0 ? { redirects } : {}),
    }
}

function analyzeSed(base: CommandStep, args: readonly string[]): CommandStep {
    const lineRange = args.map(extractSedLineRange).find((value): value is string => value !== undefined)
    const targets = pathTargets(args.filter((arg) => !arg.startsWith("-") && extractSedLineRange(arg) === undefined))
    return withStep(base, {
        operation: lineRange ? "read_range" : "read_file",
        effect: "read_only",
        targets,
        confidence: targets.length > 0 ? "high" : "medium",
        ...(lineRange ? { selectors: { lineRange } } : {}),
    })
}

function analyzeGit(base: CommandStep, args: readonly string[]): CommandStep {
    const subcommand = args[0]
    if (!subcommand) {
        return withStep(base, { operation: "unknown", effect: "unknown", confidence: "medium" })
    }

    if (["status", "log", "show"].includes(subcommand)) {
        return withStep(base, {
            subcommand,
            operation: subcommand === "status" ? "inspect_status" : "inspect_history",
            effect: "read_only",
            targets: gitPathspecTargets(args.slice(1)),
            confidence: "high",
        })
    }
    if (subcommand === "diff") {
        return withStep(base, {
            subcommand,
            operation: "inspect_diff",
            effect: "read_only",
            targets: gitPathspecTargets(args.slice(1)),
            confidence: "high",
        })
    }
    if (["add", "commit", "restore", "checkout", "switch", "merge", "rebase", "reset"].includes(subcommand)) {
        return withStep(base, {
            subcommand,
            operation: "vcs_write",
            effect: subcommand === "reset" ? "destructive" : "write",
            targets: gitPathspecTargets(args.slice(1)),
            confidence: "high",
        })
    }
    if (["push", "pull", "fetch", "clone"].includes(subcommand)) {
        return withStep(base, {
            subcommand,
            operation: subcommand === "push" ? "publish" : "fetch_repo",
            effect: subcommand === "push" ? "network" : "read_only",
            targets: [],
            confidence: "high",
        })
    }

    return withStep(base, { subcommand, operation: "git_command", effect: "unknown", confidence: "medium" })
}

function analyzePackageManager(base: CommandStep, args: readonly string[]): CommandStep {
    const workspace = extractWorkspace(args)
    const scriptName = extractScriptName(base.commandName, args)
    const operation = scriptOperation(scriptName, args)
    const effect = packageManagerEffect(operation, args)
    const targets = workspace ? [{ type: "workspace" as const, value: workspace }] : []
    return withStep(base, {
        operation,
        effect,
        targets,
        confidence: operation === "run_command" ? "medium" : "high",
        ...(workspace ? { workspace } : {}),
        ...(scriptName ? { scriptName } : {}),
    })
}

function analyzeSearch(base: CommandStep, args: readonly string[]): CommandStep {
    const pattern = args.find((arg) => !arg.startsWith("-"))
    const targetArgs = pattern ? args.slice(args.indexOf(pattern) + 1) : args
    const targets = pathTargets(targetArgs)
    return withStep(base, {
        operation: "search",
        effect: "read_only",
        targets,
        confidence: "high",
        ...(pattern ? { selectors: { pattern } } : {}),
    })
}

function analyzeRead(base: CommandStep, args: readonly string[]): CommandStep {
    const targets = pathTargets(args)
    return withStep(base, {
        operation: "read_file",
        effect: "read_only",
        targets,
        confidence: targets.length > 0 ? "high" : "medium",
    })
}

function analyzeList(base: CommandStep, args: readonly string[]): CommandStep {
    const targets = pathTargets(args)
    return withStep(base, {
        operation: "list",
        effect: "read_only",
        targets: targets.length > 0 ? targets : [{ type: "directory", value: "." }],
        confidence: "high",
    })
}

function analyzeStreamTransform(base: CommandStep, args: readonly string[]): CommandStep {
    return withStep(base, {
        operation: "limit_output",
        effect: "read_only",
        targets: pathTargets(args).length > 0 ? pathTargets(args) : [{ type: "stream", value: "stdin" }],
        confidence: "medium",
    })
}

function withStep(base: CommandStep, patch: Partial<CommandStep>): CommandStep {
    return {
        ...base,
        ...patch,
        targets: uniqueTargets([...base.targets, ...(patch.targets ?? [])]),
    }
}

function splitSequence(command: string): readonly SequencePart[] {
    const parts: SequencePart[] = []
    let current = ""
    let pendingOperator: SequencePart["operatorFromPrevious"]
    const state: ShellState = { quote: null, escaped: false, parenDepth: 0 }

    for (let index = 0; index < command.length; index += 1) {
        const char = command[index] ?? ""
        const next = command[index + 1] ?? ""
        updateShellState(state, char)

        if (!state.quote && state.parenDepth === 0) {
            const operator = char === "&" && next === "&" ? "&&" : char === "|" && next === "|" ? "||" : char === ";" ? ";" : null
            if (operator) {
                pushSequencePart(parts, current, pendingOperator)
                current = ""
                pendingOperator = operator
                if (operator !== ";") index += 1
                continue
            }
        }
        current += char
    }
    pushSequencePart(parts, current, pendingOperator)
    return parts
}

function splitPipeline(command: string): readonly string[] {
    const parts: string[] = []
    let current = ""
    const state: ShellState = { quote: null, escaped: false, parenDepth: 0 }

    for (let index = 0; index < command.length; index += 1) {
        const char = command[index] ?? ""
        const next = command[index + 1] ?? ""
        updateShellState(state, char)
        if (!state.quote && state.parenDepth === 0 && char === "|" && next !== "|") {
            const trimmed = current.trim()
            if (trimmed) parts.push(trimmed)
            current = ""
            continue
        }
        current += char
    }
    const trimmed = current.trim()
    if (trimmed) parts.push(trimmed)
    return parts
}

function tokenizeShell(command: string): readonly string[] {
    const tokens: string[] = []
    let current = ""
    let quote: "'" | "\"" | null = null
    let escaped = false

    for (const char of command) {
        if (escaped) {
            current += char
            escaped = false
            continue
        }
        if (char === "\\") {
            escaped = true
            continue
        }
        if (quote) {
            if (char === quote) {
                quote = null
            } else {
                current += char
            }
            continue
        }
        if (char === "'" || char === "\"") {
            quote = char
            continue
        }
        if (/\s/.test(char)) {
            if (current) {
                tokens.push(current)
                current = ""
            }
            continue
        }
        current += char
    }
    if (current) tokens.push(current)
    return tokens
}

function extractRedirects(tokens: readonly string[]): { readonly tokens: readonly string[]; readonly redirects: readonly CommandRedirect[] } {
    const cleanTokens: string[] = []
    const redirects: CommandRedirect[] = []
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index] ?? ""
        const next = tokens[index + 1]
        const attached = token.match(/^(2>>|2>|>>|>|<|&>)(.+)$/)
        if (attached) {
            redirects.push({ operator: attached[1] ?? token, target: { type: "file", value: attached[2] ?? "" } })
            continue
        }
        if (isRedirectOperator(token)) {
            if (next) {
                redirects.push({ operator: token, target: { type: "file", value: next } })
                index += 1
            }
            continue
        }
        cleanTokens.push(token)
    }
    return { tokens: cleanTokens, redirects }
}

function updateShellState(state: ShellState, char: string): void {
    if (state.escaped) {
        state.escaped = false
        return
    }
    if (char === "\\") {
        state.escaped = true
        return
    }
    if (state.quote) {
        if (char === state.quote) state.quote = null
        return
    }
    if (char === "'" || char === "\"") {
        state.quote = char
        return
    }
    if (char === "(") state.parenDepth += 1
    if (char === ")" && state.parenDepth > 0) state.parenDepth -= 1
}

function pushSequencePart(parts: SequencePart[], raw: string, operatorFromPrevious: SequencePart["operatorFromPrevious"]): void {
    const trimmed = raw.trim()
    if (!trimmed) return
    parts.push({
        raw: trimmed,
        ...(operatorFromPrevious ? { operatorFromPrevious } : {}),
    })
}

function resolveStructure(sequence: readonly SequencePart[], steps: readonly CommandStep[]): CommandStructure {
    if (sequence.length > 1) return steps.some((step) => step.pipeline && step.pipeline.length > 0) ? "compound" : "sequence"
    if (steps[0]?.pipeline && steps[0].pipeline.length > 0) return "pipeline"
    return "simple"
}

function combineEffects(effects: readonly CommandEffect[]): CommandEffect {
    if (effects.includes("destructive")) return "destructive"
    if (effects.includes("write")) return "write"
    if (effects.includes("network")) return "network"
    if (effects.includes("execute_check")) return "execute_check"
    if (effects.length > 0 && effects.every((effect) => effect === "read_only")) return "read_only"
    return "unknown"
}

function combineConfidence(values: readonly CommandConfidence[]): CommandConfidence {
    if (values.includes("low")) return "low"
    if (values.includes("medium")) return "medium"
    return "high"
}

function detectFailureMasked(sequence: readonly SequencePart[]): boolean {
    return sequence.some((part) => part.operatorFromPrevious === "||" && /^(true|:)\b/.test(part.raw.trim()))
}

function extractSedLineRange(arg: string): string | undefined {
    const match = arg.match(/^(\d+)(?:,(\d+))?p$/)
    if (!match) return undefined
    return match[2] ? `${match[1]},${match[2]}` : match[1]
}

function extractWorkspace(args: readonly string[]): string | undefined {
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index] ?? ""
        if (arg === "--workspace" || arg === "-w") return args[index + 1]
        const equalsMatch = arg.match(/^--workspace=(.+)$/)
        if (equalsMatch) return equalsMatch[1]
    }
    return undefined
}

function extractScriptName(commandName: string, args: readonly string[]): string | undefined {
    const filtered = stripPackageManagerOptions(args)
    if (commandName === "yarn" && filtered[0] && filtered[0] !== "run") return filtered[0]
    if (filtered[0] === "run" || filtered[0] === "run-script") return filtered[1]
    return filtered[0]
}

function scriptOperation(scriptName: string | undefined, args: readonly string[]): string {
    const normalizedArgs = args.join(" ").toLowerCase()
    const name = (scriptName ?? "").toLowerCase()
    if (name.includes("test") || normalizedArgs.includes("vitest") || normalizedArgs.includes("jest")) return "run_test"
    if (name.includes("lint") || name.includes("format") || normalizedArgs.includes("eslint")) return "run_lint"
    if (name.includes("build") || normalizedArgs.includes("tsc")) return "run_build"
    if (["install", "add", "i"].includes(name)) return "install_dependency"
    if (["publish"].includes(name)) return "publish"
    return "run_command"
}

function packageManagerEffect(operation: string, args: readonly string[]): CommandEffect {
    if (operation === "install_dependency") return "network"
    if (operation === "publish") return "network"
    if (operation === "run_test" || operation === "run_lint" || operation === "run_build") return "execute_check"
    if (args.some((arg) => arg === "install" || arg === "add" || arg === "i")) return "network"
    return "unknown"
}

function stripPackageManagerOptions(args: readonly string[]): readonly string[] {
    const result: string[] = []
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index] ?? ""
        if (arg === "--workspace" || arg === "-w" || arg === "--prefix") {
            index += 1
            continue
        }
        if (arg.startsWith("--workspace=") || arg.startsWith("--prefix=")) continue
        if (arg.startsWith("-")) continue
        result.push(arg)
    }
    return result
}

function gitPathspecTargets(args: readonly string[]): readonly CommandTarget[] {
    const separatorIndex = args.indexOf("--")
    const candidates = separatorIndex >= 0 ? args.slice(separatorIndex + 1) : args.filter((arg) => !arg.startsWith("-") && !looksLikeGitRevision(arg))
    return pathTargets(candidates)
}

function pathTargets(args: readonly string[]): readonly CommandTarget[] {
    return args
        .filter((arg) => arg.length > 0 && !arg.startsWith("-") && !isLikelyExpression(arg))
        .map((arg) => ({ type: targetTypeForPath(arg), value: arg }))
}

function urlTargets(args: readonly string[]): readonly CommandTarget[] {
    return args
        .filter((arg) => /^https?:\/\//.test(arg))
        .map((arg) => ({ type: "url", value: arg }))
}

function targetTypeForPath(value: string): CommandTarget["type"] {
    if (value === "-" || value === "/dev/stdin") return "stream"
    if (value === "." || value.endsWith("/")) return "directory"
    if (value.includes("*")) return "path"
    return "file"
}

function uniqueTargets(targets: readonly CommandTarget[]): readonly CommandTarget[] {
    const seen = new Set<string>()
    const result: CommandTarget[] = []
    for (const target of targets) {
        const key = `${target.type}:${target.value}`
        if (seen.has(key)) continue
        seen.add(key)
        result.push(target)
    }
    return result
}

function isRedirectOperator(token: string): boolean {
    return token === ">" || token === ">>" || token === "<" || token === "2>" || token === "2>>" || token === "&>"
}

function isEnvAssignment(token: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)
}

function isLikelyExpression(value: string): boolean {
    return /^[0-9,$/{}().*+?[\\\]^]+p?$/.test(value)
}

function looksLikeGitRevision(value: string): boolean {
    return value === "HEAD" || /^[A-Fa-f0-9]{7,40}$/.test(value) || value.includes("..")
}

function containsComplexShell(command: string): boolean {
    return command.includes("$(") || command.includes("`") || command.includes("<<")
}
