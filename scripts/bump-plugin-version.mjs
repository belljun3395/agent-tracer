#!/usr/bin/env node
// 설치본은 버전 문자열이 올라갈 때만 갱신되므로, 번들이 바뀌면 버전도 함께 올린다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 플러그인 버전을 함께 들고 있어 한 값으로 유지해야 하는 매니페스트다. */
export const MANIFESTS = [
  { file: "packages/runtime/.claude-plugin/plugin.json", at: ["version"] },
  { file: ".claude-plugin/marketplace.json", at: ["metadata", "version"] },
];

export function nextPatch(version) {
  const parts = version.trim().split(".");
  if (parts.length !== 3) throw new Error(`버전이 major.minor.patch가 아니다: ${version}`);
  const numbers = parts.map((part) => Number.parseInt(part, 10));
  if (numbers.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error(`버전이 major.minor.patch가 아니다: ${version}`);
  }
  return `${numbers[0]}.${numbers[1]}.${numbers[2] + 1}`;
}

function readAt(value, at) {
  return at.reduce((node, key) => (node === undefined ? undefined : node[key]), value);
}

function writeAt(value, at, next) {
  const parent = readAt(value, at.slice(0, -1));
  parent[at.at(-1)] = next;
}

/** 매니페스트를 모두 같은 다음 버전으로 올리고 그 버전을 돌려준다. */
export function bumpManifests(root = ROOT, manifests = MANIFESTS) {
  const documents = manifests.map((manifest) => ({
    manifest,
    filePath: path.join(root, manifest.file),
    json: JSON.parse(fs.readFileSync(path.join(root, manifest.file), "utf8")),
  }));

  const versions = new Set(documents.map((doc) => readAt(doc.json, doc.manifest.at)));
  if (versions.size !== 1) {
    throw new Error(`매니페스트 버전이 서로 다르다: ${[...versions].join(", ")}`);
  }

  const next = nextPatch([...versions][0]);
  for (const doc of documents) {
    writeAt(doc.json, doc.manifest.at, next);
    fs.writeFileSync(doc.filePath, `${JSON.stringify(doc.json, null, 2)}\n`);
  }
  return next;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(bumpManifests());
}
