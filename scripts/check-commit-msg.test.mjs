import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkCommitMessage } from "./check-commit-msg.mjs";

describe("checkCommitMessage", () => {
  it("타입과 범위와 한글 행위 제목을 갖춘 메시지를 통과시킨다", () => {
    assert.deepEqual(checkCommitMessage("feat(kernel): 이벤트 어휘를 세운다"), []);
  });

  it("범위 없는 메시지도 통과시킨다", () => {
    assert.deepEqual(checkCommitMessage("docs: 저장소를 소개한다"), []);
  });

  it("허용 목록에 없는 타입을 거부한다", () => {
    const errors = checkCommitMessage("perf(kernel): 판정을 빠르게 한다");
    assert.equal(errors.length, 1);
    assert.match(errors[0], /타입 "perf"/);
  });

  it("허용 목록에 없는 범위를 거부한다", () => {
    const errors = checkCommitMessage("feat(temporal-worker): 워커를 세운다");
    assert.equal(errors.length, 1);
    assert.match(errors[0], /범위 "temporal-worker"/);
  });

  it("명사구 제목을 거부한다", () => {
    const errors = checkCommitMessage("chore(repo): 툴체인 토대");
    assert.equal(errors.length, 1);
    assert.match(errors[0], /행위 문장/);
  });

  it("영문 제목을 거부한다", () => {
    const errors = checkCommitMessage("feat(web): add job monitoring page");
    assert.ok(errors.some((error) => /한글/.test(error)));
  });

  it("60자를 넘는 제목을 거부한다", () => {
    const errors = checkCommitMessage(`feat(web): ${"가".repeat(61)}한다`);
    assert.ok(errors.some((error) => /60자/.test(error)));
  });

  it("정형 블록 본문을 거부한다", () => {
    const errors = checkCommitMessage("feat(web): 화면을 세운다\n\nTested: 수동 확인");
    assert.ok(errors.some((error) => /정형 블록/.test(error)));
  });

  it("네 줄을 넘는 본문을 거부한다", () => {
    const body = ["한", "두", "세", "네", "다섯"].join("\n");
    const errors = checkCommitMessage(`feat(web): 화면을 세운다\n\n${body}`);
    assert.ok(errors.some((error) => /본문이/.test(error)));
  });

  it("공동 작성자 트레일러를 본문 줄 수에서 세지 않는다", () => {
    const message = "feat(web): 화면을 세운다\n\n한 줄\n\nCo-authored-by: 누군가 <a@b.c>";
    assert.deepEqual(checkCommitMessage(message), []);
  });

  it("형식을 벗어난 제목을 거부한다", () => {
    const errors = checkCommitMessage("아무 말이나 적는다");
    assert.equal(errors.length, 1);
    assert.match(errors[0], /형식이/);
  });

  it("머지 커밋을 검사하지 않는다", () => {
    assert.deepEqual(checkCommitMessage("Merge branch 'main'"), []);
  });
});
