// 에이전트 실행 백엔드가 쓰는 읽기 전용 역할을 만들어 계약인 뷰에만 SELECT를 주므로, 계약 밖의 열과 쓰기는 규율이 아니라 데이터베이스 권한이 막는다.
import process from "node:process";
import pg from "pg";

const DATABASE = "tracer";

// 뷰 목록은 뷰 엔티티가 소유하므로 여기서 다시 적지 않는다.
async function readableViews() {
    const { tracerViewNames } = await import(
        "../packages/server/libs/tracer-domain/src/persistence/tracer.table.catalog.js"
    );
    return tracerViewNames();
}

function adminClient() {
    return new pg.Client({
        host: process.env.TRACER_DB_HOST ?? "127.0.0.1",
        port: Number(process.env.TRACER_DB_PORT ?? 5433),
        user: process.env.POSTGRES_USER ?? "monitor",
        password: process.env.POSTGRES_PASSWORD ?? "monitor",
        database: DATABASE,
    });
}

function quoteIdentifier(name) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`이름이 식별자 규칙을 벗어난다: ${name}`);
    return `"${name}"`;
}

// 비밀번호는 역할 정의문의 일부라 자리표시자로 넘길 수 없어 문자열 리터럴로 짜 넣는다.
function quoteLiteral(value) {
    return `'${value.replaceAll("'", "''")}'`;
}

async function main() {
    const views = await readableViews();
    if (views.length === 0) throw new Error("읽기 권한을 줄 뷰가 없다. 뷰 엔티티 등록을 확인한다.");

    const role = process.env.AGENT_DB_READER_USER ?? "agent_reader";
    const password = process.env.AGENT_DB_READER_PASSWORD ?? "agentreader";
    const client = adminClient();
    await client.connect();
    try {
        const quotedRole = quoteIdentifier(role);
        const secret = quoteLiteral(password);
        const existing = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role]);
        const verb = existing.rowCount === 0 ? "CREATE" : "ALTER";
        await client.query(`${verb} ROLE ${quotedRole} LOGIN PASSWORD ${secret}`);

        // 이전에 넓게 열린 권한이 남아 있어도 계약이 좁아지도록 매번 회수하고 다시 준다.
        await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${quotedRole}`);
        await client.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(DATABASE)} TO ${quotedRole}`);
        await client.query(`GRANT USAGE ON SCHEMA public TO ${quotedRole}`);
        await client.query(`GRANT SELECT ON ${views.map(quoteIdentifier).join(", ")} TO ${quotedRole}`);
        console.log(`읽기 전용 역할 ${role}에 뷰 ${views.length}개 SELECT 권한을 부여했다.`);

        // LangGraph 장기기억에 한해 read-through-views 경계를 의도적으로 열어, 이 역할에 정본 테이블 직접 읽기·쓰기를 허용한다.
        const memoryTable = quoteIdentifier("chat_user_memories");
        await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${memoryTable} TO ${quotedRole}`);
        console.log(`역할 ${role}에 ${memoryTable} 직접 읽기·쓰기 권한을 부여했다.`);
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
