import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { MANIFESTS, bumpManifests, nextPatch } from "./bump-plugin-version.mjs";

function fixture(version) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bump-"));
  const plugin = path.join(root, MANIFESTS[0].file);
  const marketplace = path.join(root, MANIFESTS[1].file);
  fs.mkdirSync(path.dirname(plugin), { recursive: true });
  fs.mkdirSync(path.dirname(marketplace), { recursive: true });
  fs.writeFileSync(plugin, JSON.stringify({ name: "agent-tracer-monitor", version }, null, 2));
  fs.writeFileSync(marketplace, JSON.stringify({ name: "agent-tracer", metadata: { version } }, null, 2));
  return { root, plugin, marketplace };
}

function versionOf(filePath, at) {
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return at.reduce((node, key) => node[key], json);
}

describe("nextPatch", () => {
  it("patch 자리만 올린다", () => {
    assert.equal(nextPatch("0.7.0"), "0.7.1");
    assert.equal(nextPatch("1.0.9"), "1.0.10");
  });

  it("major.minor.patch가 아니면 거부한다", () => {
    assert.throws(() => nextPatch("0.7"));
    assert.throws(() => nextPatch("0.7.x"));
  });
});

describe("bumpManifests", () => {
  it("플러그인과 마켓플레이스 버전을 같은 값으로 올린다", () => {
    const { root, plugin, marketplace } = fixture("0.7.0");

    const next = bumpManifests(root);

    assert.equal(next, "0.7.1");
    assert.equal(versionOf(plugin, MANIFESTS[0].at), "0.7.1");
    assert.equal(versionOf(marketplace, MANIFESTS[1].at), "0.7.1");
  });

  // 버전이 갈라진 채로 올리면 어느 쪽이 설치본을 갱신하는지 알 수 없다.
  it("매니페스트 버전이 서로 다르면 올리지 않는다", () => {
    const { root, marketplace } = fixture("0.7.0");
    fs.writeFileSync(marketplace, JSON.stringify({ metadata: { version: "0.6.0" } }, null, 2));

    assert.throws(() => bumpManifests(root), /서로 다르다/);
  });
});
