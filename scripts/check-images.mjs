// 빌드가 성공해도 못 뜨는 이미지가 있으므로 다섯을 빌드하고 실행에 필요한 것을 담았는지 확인한다.
//
//   npm run check:images                    빌드 + 내용 검사
//   npm run check:images -- --skip-build    이미 만든 이미지만 검사

import { execFileSync } from "node:child_process";
import process from "node:process";

const BAKE_FILE = "docker-bake.hcl";

// 소스를 그대로 실행하므로 커널 소스와 생성된 별칭 맵과 의존성이 이미지 안에 있어야 앱이 뜬다.
const SERVER_APPS = ["runtime-api", "tracer-api", "projector", "ai-agent-worker"];
const SERVER_ASSERTIONS = "test -d packages/kernel/src && test -f tsconfig.paths.json && test -d node_modules";
const WEB_ASSERTIONS = "test -s /usr/share/nginx/html/index.html";

function run(command, args) {
    execFileSync(command, args, { stdio: "inherit" });
}

function inspect(image, assertions) {
    process.stdout.write(`  ${image} … `);
    try {
        execFileSync(
            "docker",
            ["run", "--rm", "--entrypoint", "sh", image, "-c", assertions],
            { stdio: ["ignore", "ignore", "pipe"] },
        );
    } catch {
        process.stdout.write("실패\n");
        return `${image}: 실행에 필요한 파일이 이미지에 없다 (${assertions})`;
    }
    process.stdout.write("통과\n");
    return null;
}

function main() {
    const skipBuild = process.argv.includes("--skip-build");
    if (!skipBuild) {
        run("docker", ["buildx", "bake", "--file", BAKE_FILE, "--load"]);
    }

    console.log("\n이미지 내용 검사");
    const failures = [
        ...SERVER_APPS.map((app) => inspect(`agent-tracer-${app}:ci`, SERVER_ASSERTIONS)),
        inspect("agent-tracer-web:ci", WEB_ASSERTIONS),
    ].filter((failure) => failure !== null);

    if (failures.length > 0) {
        console.error("\n이미지 검사 실패");
        for (const failure of failures) console.error(`  ${failure}`);
        process.exit(1);
    }
    console.log("\n이미지 다섯이 실행에 필요한 것을 모두 담았다");
}

main();
