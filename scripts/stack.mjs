// 소스 실행이 아니라 배포되는 이미지 그대로 앱 전체를 도커로 띄운다.
//
//   npm run stack:up                   인프라와 앱을 전부 띄운다
//   npm run stack:up:local             AI 잡을 Claude SDK + 구독 토큰으로 돌리는 로컬 오버라이드로 띄운다
//   npm run stack:down                 전부 내린다 (볼륨은 남는다)
//   npm run stack:down -- --volumes    볼륨까지 지운다
//   npm run stack:logs                 앱 로그를 따라간다

import { execFileSync } from "node:child_process";
import process from "node:process";

const APPS = ["runtime-api", "tracer-api", "projector", "ai-agent-worker", "agents", "web", "edge"];
const ENTRYPOINT = "http://127.0.0.1:3847";
const READY_TIMEOUT_MS = 5 * 60_000;
const POLL_MS = 3_000;

// --local이면 로컬 오버라이드 compose를 겹쳐 읽는다(down/logs는 같은 프로젝트라 불필요).
const COMPOSE_FILES = process.argv.includes("--local")
    ? ["-f", "docker-compose.yml", "-f", "docker-compose.local.yml"]
    : [];

function compose(args, options = {}) {
    try {
        return execFileSync("docker", ["compose", ...COMPOSE_FILES, ...args], { stdio: "inherit", ...options });
    } catch (error) {
        // 도커가 이미 이유를 출력했으므로 노드 스택을 덧붙이지 않는다.
        process.exit(typeof error.status === "number" ? error.status : 1);
    }
}

function services() {
    const raw = execFileSync("docker", ["compose", ...COMPOSE_FILES, "ps", "-a", "--format", "json"], { encoding: "utf8" });
    return raw
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}

/** 아직 준비되지 않은 서비스의 이름과 상태다. */
function pending() {
    return services()
        .filter((service) => {
            // 원샷 서비스는 성공 종료가 곧 준비 완료다.
            if (service.State === "exited") return service.ExitCode !== 0;
            if (service.State !== "running") return true;
            // 헬스체크가 없는 서비스는 떠 있으면 준비된 것으로 본다.
            return service.Health !== "" && service.Health !== "healthy";
        })
        .map((service) => `${service.Service}(${service.Health || service.State})`);
}

async function waitUntilReady() {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    for (;;) {
        const waiting = pending();
        if (waiting.length === 0) return;
        if (Date.now() > deadline) {
            console.error(`\n준비되지 않은 서비스: ${waiting.join(", ")}`);
            console.error("로그: npm run stack:logs");
            process.exit(1);
        }
        process.stdout.write(`\r대기 중: ${waiting.join(", ")}`.slice(0, 110).padEnd(112));
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
}

async function up() {
    // --wait은 원샷 서비스가 정상 종료해도 실패로 보므로 직접 기다린다.
    compose(["up", "-d", "--build"]);
    await waitUntilReady();
    console.log(`\r스택이 떴다.`.padEnd(112));
    console.log(`  대시보드      ${ENTRYPOINT}`);
    console.log("  Temporal UI   http://127.0.0.1:8233");
    console.log("  OpenSearch    http://127.0.0.1:9200");
    console.log("\n로그: npm run stack:logs / 내리기: npm run stack:down");
}

function down() {
    const args = ["down", "--remove-orphans"];
    if (process.argv.includes("--volumes")) args.push("--volumes");
    compose(args);
}

function logs() {
    compose(["logs", "-f", "--tail", "50", ...APPS]);
}

const COMMANDS = { up, down, logs };

async function main() {
    const command = COMMANDS[process.argv[2] ?? ""];
    if (command === undefined) {
        console.error("사용: node scripts/stack.mjs <up|down|logs>");
        process.exit(2);
    }
    await command();
}

await main();
