import type {
    CommandEffect,
    CommandStep,
} from "~runtime/domain/ingest/model/command.analysis.model.js";
import {withStep} from "~runtime/domain/ingest/model/command.classifier.model.js";

/** 안쪽 명령을 대신 실행하는 래퍼이며 subcommand가 있으면 두 토큰을 벗긴다. */
interface CommandWrapper {
    readonly name: string;
    readonly subcommand?: string;
}

/** 새 래퍼는 여기 한 줄로 등록한다. */
const COMMAND_WRAPPERS: readonly CommandWrapper[] = [
    {name: "npx"},
    {name: "bunx"},
    {name: "uv", subcommand: "run"},
    {name: "uvx"},
    {name: "poetry", subcommand: "run"},
    {name: "pipenv", subcommand: "run"},
    {name: "pnpm", subcommand: "dlx"},
    {name: "yarn", subcommand: "dlx"},
    {name: "bun", subcommand: "run"},
    {name: "deno", subcommand: "run"},
    {name: "python", subcommand: "-m"},
    {name: "python3", subcommand: "-m"},
];

/** `-p pkg`처럼 뒤 토큰까지 값으로 데려가는 래퍼 플래그다. */
const WRAPPER_VALUE_FLAGS: ReadonlySet<string> = new Set(["-p", "--package", "-c", "--call"]);

/** 실행기 하나가 어떤 조작·효과로 관측되는지를 선언한다. */
interface RunnerSpec {
    readonly command: string;
    readonly subcommand?: string;
    readonly operation: "run_test" | "run_lint" | "run_build";
    readonly effect: CommandEffect;
}

/** 새 언어·러너는 여기 한 줄(서브커맨드가 있으면 몇 줄)로 등록한다. */
const RUNNER_SPECS: readonly RunnerSpec[] = [
    {command: "vitest", operation: "run_test", effect: "execute_check"},
    {command: "jest", operation: "run_test", effect: "execute_check"},
    {command: "mocha", operation: "run_test", effect: "execute_check"},
    {command: "ava", operation: "run_test", effect: "execute_check"},
    {command: "pytest", operation: "run_test", effect: "execute_check"},
    {command: "phpunit", operation: "run_test", effect: "execute_check"},
    {command: "rspec", operation: "run_test", effect: "execute_check"},
    {command: "tsc", operation: "run_build", effect: "execute_check"},
    {command: "eslint", operation: "run_lint", effect: "execute_check"},
    {command: "prettier", operation: "run_lint", effect: "execute_check"},
    {command: "biome", operation: "run_lint", effect: "execute_check"},
    {command: "ruff", operation: "run_lint", effect: "execute_check"},
    {command: "black", operation: "run_lint", effect: "execute_check"},
    {command: "flake8", operation: "run_lint", effect: "execute_check"},
    {command: "mypy", operation: "run_build", effect: "execute_check"},
    {command: "go", subcommand: "test", operation: "run_test", effect: "execute_check"},
    {command: "go", subcommand: "build", operation: "run_build", effect: "execute_check"},
    {command: "go", subcommand: "vet", operation: "run_lint", effect: "execute_check"},
    {command: "cargo", subcommand: "test", operation: "run_test", effect: "execute_check"},
    {command: "cargo", subcommand: "build", operation: "run_build", effect: "execute_check"},
    {command: "cargo", subcommand: "check", operation: "run_build", effect: "execute_check"},
    {command: "cargo", subcommand: "clippy", operation: "run_lint", effect: "execute_check"},
    {command: "gradle", subcommand: "test", operation: "run_test", effect: "execute_check"},
    {command: "gradle", subcommand: "build", operation: "run_build", effect: "execute_check"},
    {command: "mvn", subcommand: "test", operation: "run_test", effect: "execute_check"},
    {command: "mvn", subcommand: "package", operation: "run_build", effect: "execute_check"},
    {command: "mvn", subcommand: "install", operation: "run_build", effect: "execute_check"},
    {command: "make", subcommand: "test", operation: "run_test", effect: "execute_check"},
    {command: "make", subcommand: "build", operation: "run_build", effect: "execute_check"},
    {command: "make", subcommand: "lint", operation: "run_lint", effect: "execute_check"},
    {command: "make", subcommand: "check", operation: "run_test", effect: "execute_check"},
];

/** 래퍼와 그 플래그를 벗겨 안쪽 실행 명령의 토큰을 돌려준다. */
export function unwrapCommand(tokens: readonly string[]): readonly string[] {
    let current = tokens;
    // 각 단계가 토큰을 최소 하나 줄이므로 반복은 반드시 끝난다.
    for (;;) {
        const stripped = stripWrapperOnce(current);
        if (stripped === null) return current;
        current = stripped;
    }
}

function stripWrapperOnce(tokens: readonly string[]): readonly string[] | null {
    const head = tokens[0];
    if (head === undefined) return null;
    const wrapper = COMMAND_WRAPPERS.find((entry) => entry.name === head);
    if (!wrapper) return null;
    if (wrapper.subcommand !== undefined && tokens[1] !== wrapper.subcommand) return null;
    const rest = tokens.slice(wrapper.subcommand !== undefined ? 2 : 1);
    const inner = skipLeadingFlags(rest);
    return inner.length > 0 ? inner : null;
}

function skipLeadingFlags(tokens: readonly string[]): readonly string[] {
    let index = 0;
    while (index < tokens.length) {
        const token = tokens[index] ?? "";
        if (!token.startsWith("-")) break;
        index += WRAPPER_VALUE_FLAGS.has(token) ? 2 : 1;
    }
    return tokens.slice(index);
}

/** 러너 테이블에 걸리면 그 조작·효과로 스텝을 만들고 아니면 null을 낸다. */
export function runnerStepFrom(
    base: CommandStep,
    commandName: string,
    args: readonly string[],
): CommandStep | null {
    const spec = matchRunner(commandName, args[0]);
    if (!spec) return null;
    return withStep(base, {
        operation: spec.operation,
        effect: spec.effect,
        confidence: "high",
        ...(spec.subcommand ? {subcommand: spec.subcommand} : {}),
    });
}

function matchRunner(commandName: string, firstArg: string | undefined): RunnerSpec | undefined {
    const withSubcommand = RUNNER_SPECS.find(
        (spec) => spec.command === commandName && spec.subcommand === firstArg,
    );
    if (withSubcommand) return withSubcommand;
    return RUNNER_SPECS.find((spec) => spec.command === commandName && spec.subcommand === undefined);
}
