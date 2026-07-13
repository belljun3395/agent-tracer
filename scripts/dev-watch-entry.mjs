#!/usr/bin/env node
// `node --watch`는 CLI 플래그로 등록한 ESM 로더를 감시 재시작 때 다시 풀지 못하므로,
// 로더를 프로그래매틱으로 register()한 뒤 엔트리를 동적 import한다.

import { register } from "node:module";
import { pathToFileURL } from "node:url";

const [, , loaderSpecifier, entryPath] = process.argv;
if (!loaderSpecifier || !entryPath) {
  console.error("사용: node --watch dev-watch-entry.mjs <로더> <엔트리>");
  process.exit(2);
}

register(loaderSpecifier, import.meta.url);
await import(pathToFileURL(entryPath).href);
