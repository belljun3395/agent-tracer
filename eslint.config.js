// eslint.config.js
//
// 구조:
//   1. Ignores
//   2. Base configs (eslint:recommended, tseslint type-checked)
//   3. COMMON BASELINE — 모든 .ts/.tsx 가 받는 규칙. **기준은 runtime**:
//      runtime 패키지는 이 블록 외에 어떤 완화 override 도 받지 않는다.
//   4. Cross-package import boundaries (server/web/runtime 분리)
//   5. server 내부 layered architecture (domain → classification → application → adapters → main)
//   6. Path 규칙 (auto-fixable)
//      - require-js-extension: 로컬/alias import 는 .js 확장자 강제 (TS ESM)
//      - no-deep-relative-import: ../../ 이상의 deep relative 금지, alias 로 자동 치환
//   7. RELAXATIONS — 외부 라이브러리/프레임워크 한계로 어쩔 수 없이 푸는 규칙들.
//      반드시 사유 코멘트와 함께. runtime 에는 적용되지 않는다.
//   8. Test 파일 완화

import fs from "node:fs";
import path from "node:path";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const PROJECT_ROOT = import.meta.dirname;

function restrictedImports(...patterns) {
  return ["error", { patterns: [...patterns] }];
}

// 패키지별 path alias — tsconfig.json 의 paths 와 1:1 일치해야 한다.
// 새 alias 를 추가하면 여기에도 함께 등록할 것.
const RUNTIME_ALIASES = {
  "~shared": path.join(PROJECT_ROOT, "packages/runtime/src/shared"),
  "~claude-code": path.join(PROJECT_ROOT, "packages/runtime/src/claude-code"),
  "~codex": path.join(PROJECT_ROOT, "packages/runtime/src/codex"),
};
// api-gateway(합성 루트)만 ~alias 를 쓴다. 하위 컨텍스트 패키지(timeline-api/run-api/…)는
// 패키지 간 import 를 @monitor/* bare specifier 로, 모듈 내부는 상대 경로로 한다.
const SERVER_ALIASES = {
  "~config": path.join(PROJECT_ROOT, "packages/server/api-gateway/src/config"),
  "~adapters": path.join(PROJECT_ROOT, "packages/server/api-gateway/src/adapters"),
  "~main": path.join(PROJECT_ROOT, "packages/server/api-gateway/src/main"),
};
const WEB_ALIASES = {
  "~domain": path.join(PROJECT_ROOT, "packages/web/src/domain"),
  "~io": path.join(PROJECT_ROOT, "packages/web/src/io"),
  "~state": path.join(PROJECT_ROOT, "packages/web/src/state"),
  "~app": path.join(PROJECT_ROOT, "packages/web/src/app"),
  "~config": path.join(PROJECT_ROOT, "packages/web/src/config"),
  "~ui": path.join(PROJECT_ROOT, "packages/web/src/ui"),
  "~lib": path.join(PROJECT_ROOT, "packages/web/src/lib"),
  "~features": path.join(PROJECT_ROOT, "packages/web/src/features"),
};

// server 의 모든 src 가 공통으로 받는 cross-package import 제한.
// layer 룰 블록(adapters 등)에서도 함께 펼쳐야 (flat config 에서 같은 rule 은 머지가 아니라 override)
// 해당 layer 파일들이 이 제한을 잃지 않는다.
// 모듈 내부 layer 의존(domain↑ 금지, usecase→repository 직접 금지 등)은
// bounded-context 마이그레이션 이후 dep-cruiser(.dependency-cruiser.cjs)가 소유한다.
const SERVER_CROSS_PACKAGE_PATTERNS = [
  { group: ["@monitor/web", "@monitor/runtime"], message: "server must not import from web or runtime packages." },
];

// ── Custom rule: 로컬/alias import 는 .js 확장자 강제 (TS ESM convention) ──
// eslint-plugin-n 의 file-extension-in-import 가 .js → .ts resolution 을 못 다뤄
// false positive 를 내므로 인라인으로 둔다.
// `import`, `export ... from`, `export * from`, dynamic `import("...")` 모두 검사한다.
const requireJsExtension = {
  meta: { type: "problem", fixable: "code", schema: [] },
  create(context) {
    const ASSET_EXTS = new Set([".json", ".css", ".svg", ".png", ".webp", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2"]);
    function check(sourceNode) {
      if (!sourceNode || sourceNode.type !== "Literal" || typeof sourceNode.value !== "string") return;
      const src = sourceNode.value;
      if (!src.startsWith(".") && !src.startsWith("~")) return;
      if (src.endsWith(".js") || ASSET_EXTS.has(src.slice(src.lastIndexOf(".")))) return;
      context.report({
        node: sourceNode,
        message: `Local/alias imports must end with .js — change to "${src}.js"`,
        fix: fixer => fixer.replaceText(sourceNode, `"${src}.js"`)
      });
    }
    return {
      ImportDeclaration(node) { check(node.source); },
      ExportNamedDeclaration(node) { if (node.source) check(node.source); },
      ExportAllDeclaration(node) { check(node.source); },
      ImportExpression(node) { check(node.source); },
    };
  }
};

// ── Custom rule: ../../ 이상의 deep relative import 금지, alias 로 자동 치환 ──
// 옵션의 aliases 는 { "~prefix": "/abs/target/dir" } 형태. import 경로를 절대경로로
// resolve 한 뒤 alias target prefix 와 매칭되면 그 자리에서 alias 형태로 fix 한다.
// 매칭 실패 시 fix 없이 에러만 보고 — 새 alias 를 tsconfig + 본 파일 상수에 추가해야 함을 알린다.
const noDeepRelativeImport = {
  meta: {
    type: "problem",
    fixable: "code",
    schema: [{
      type: "object",
      properties: {
        aliases: { type: "object", additionalProperties: { type: "string" } }
      },
      additionalProperties: false
    }]
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const aliases = Object.entries(opts.aliases ?? {});
    const fileDir = path.dirname(context.filename);
    function resolveAlias(absolute) {
      for (const [alias, target] of aliases) {
        // Case A: 임포트가 alias 디렉토리 내부 파일을 가리킴 (alias/sub/path.js)
        if (absolute.startsWith(target + path.sep)) {
          return `${alias}${absolute.slice(target.length)}`;
        }
        // Case B: ../../config.js 처럼 dir/index.js 를 .js 한 글자로 줄여 쓴 형태.
        //         TS Bundler resolution 에서 합법이지만 alias 매칭은 따로 처리.
        if (absolute === `${target}.js`) {
          return `${alias}/index.js`;
        }
        // Case C: exact match (확장자 없이 alias 자체를 가리킴)
        if (absolute === target) {
          return alias;
        }
      }
      return null;
    }
    function check(sourceNode) {
      if (!sourceNode || sourceNode.type !== "Literal" || typeof sourceNode.value !== "string") return;
      const src = sourceNode.value;
      if (!src.startsWith("../../")) return;
      const absolute = path.resolve(fileDir, src);
      const replacement = resolveAlias(absolute);
      if (replacement) {
        context.report({
          node: sourceNode,
          message: `Use alias "${replacement}" instead of deep relative "${src}".`,
          fix: fixer => fixer.replaceText(sourceNode, `"${replacement}"`)
        });
      } else {
        context.report({
          node: sourceNode,
          message: `Deep relative import "${src}" — define a path alias in tsconfig.json (and register it in eslint.config.js).`
        });
      }
    }
    return {
      ImportDeclaration(node) { check(node.source); },
      ExportNamedDeclaration(node) { if (node.source) check(node.source); },
      ExportAllDeclaration(node) { check(node.source); },
      ImportExpression(node) { check(node.source); },
    };
  }
};

// ── Custom rule: 디렉토리 barrel 은 `dir.js` 단축 표기가 아닌 `dir/index.js` 로 명시한다 ──
// TS Bundler resolution 은 `./ports.js` 를 `./ports/index.ts` 로 풀지 않는다
// (tsx/esbuild 는 풀어주므로 dev 에선 동작하지만 tsc --noEmit 이 깨진다).
// runtime 컨벤션과 동일하게 항상 명시적으로 쓰도록 강제하고, 자동으로 치환한다.
const preferBarrelIndex = {
  meta: {
    type: "problem",
    fixable: "code",
    schema: [{
      type: "object",
      properties: {
        aliases: { type: "object", additionalProperties: { type: "string" } }
      },
      additionalProperties: false
    }]
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const aliases = Object.entries(opts.aliases ?? {});
    const fileDir = path.dirname(context.filename);
    function resolveAbsoluteWithoutExt(src) {
      const withoutExt = src.slice(0, -3);
      if (src.startsWith("~")) {
        for (const [alias, target] of aliases) {
          if (withoutExt === alias) return target;
          if (withoutExt.startsWith(alias + "/")) {
            return path.join(target, withoutExt.slice(alias.length + 1));
          }
        }
        return null;
      }
      return path.resolve(fileDir, withoutExt);
    }
    function isFile(p) {
      try { return fs.statSync(p).isFile(); } catch { return false; }
    }
    function isDirWithIndex(p) {
      try {
        if (!fs.statSync(p).isDirectory()) return false;
      } catch { return false; }
      return isFile(path.join(p, "index.ts")) || isFile(path.join(p, "index.tsx"));
    }
    function check(sourceNode) {
      if (!sourceNode || sourceNode.type !== "Literal" || typeof sourceNode.value !== "string") return;
      const src = sourceNode.value;
      if (!src.endsWith(".js")) return;
      if (!src.startsWith(".") && !src.startsWith("~")) return;
      if (src.endsWith("/index.js")) return;
      const absWithoutExt = resolveAbsoluteWithoutExt(src);
      if (!absWithoutExt) return;
      // 이미 파일을 가리키면 OK (file-style 정상 동작). 디렉토리 + index 인 경우만 잡는다.
      if (isFile(absWithoutExt + ".ts") || isFile(absWithoutExt + ".tsx")) return;
      if (!isDirWithIndex(absWithoutExt)) return;
      const fixed = src.slice(0, -3) + "/index.js";
      context.report({
        node: sourceNode,
        message: `Barrel directory import "${src}" — write the index path explicitly as "${fixed}".`,
        fix: fixer => fixer.replaceText(sourceNode, `"${fixed}"`)
      });
    }
    return {
      ImportDeclaration(node) { check(node.source); },
      ExportNamedDeclaration(node) { if (node.source) check(node.source); },
      ExportAllDeclaration(node) { check(node.source); },
      ImportExpression(node) { check(node.source); },
    };
  }
};

const localPlugin = {
  rules: {
    "require-js-extension": requireJsExtension,
    "no-deep-relative-import": noDeepRelativeImport,
    "prefer-barrel-index": preferBarrelIndex,
  }
};

export default tseslint.config(
  // ── 1. Ignores ─────────────────────────────────────────────────
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/*.d.ts.map",
      "**/*.js.map",
      // Standalone runtime build script — invoked directly (bun/tsx build.ts),
      // not part of the TS project (outside tsconfig include), so the
      // typed-lint project service can't resolve it.
      "packages/runtime/build.ts",
      "packages/runtime/build/**"
    ]
  },

  // ── 2. Base configs ───────────────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{js,jsx}"],
    ...tseslint.configs.disableTypeChecked
  },

  // ── 3. COMMON BASELINE (모든 .ts/.tsx) ────────────────────────
  // 기준은 runtime — runtime 은 이 블록 외에 어떤 완화도 받지 않는다.
  // 다른 패키지가 이 baseline 에서 무엇을 추가/완화하는지는 아래 블록에서 명시.
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/return-await": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }]
    }
  },

  // ── 4. Cross-package boundaries ───────────────────────────────
  // 기본 (다른 패턴이 덮어쓰지 않는 파일들)
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: { "no-restricted-imports": restrictedImports() }
  },
  // server: web/runtime 직접 import 금지 (모든 server 패키지)
  {
    files: ["packages/server/*/src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrictedImports(...SERVER_CROSS_PACKAGE_PATTERNS) }
  },
  // web: server/runtime 직접 import 금지
  {
    files: ["packages/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports(
        { group: ["@monitor/server", "@monitor/runtime"], message: "web must not import from server or runtime packages." }
      )
    }
  },
  // runtime: server/web 직접 import 금지
  {
    files: ["packages/runtime/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports(
        { group: ["@monitor/server", "@monitor/web"], message: "runtime must not import from server or web packages." }
      )
    }
  },

  // ── 5. api-gateway adapters 경계 ──────────────────────────────
  // 컨텍스트 패키지(timeline-api/run-api/rules-api/insight-api) 내부 layer 의존은
  // dep-cruiser 가 소유한다(.dependency-cruiser.cjs 의 <module>-* 규칙). eslint 는
  // 합성 루트(api-gateway) adapters 의 cross-package 제한과 adapters → main 금지만
  // enforce 한다. (flat config override 회피 위해 패턴 spread)
  {
    files: ["packages/server/api-gateway/src/adapters/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports(
        ...SERVER_CROSS_PACKAGE_PATTERNS,
        { group: ["../main/**", "~main/**"], message: "adapters must not import from main; move shared HTTP/Nest helpers into adapters or depend on application ports." }
      )
    }
  },

  // ── 5-b. web 내부 layered architecture ────────────────────────
  // domain/types → io → state → app. Alias import 로 ring 을 명시한다.
  {
    files: ["packages/web/src/domain/**/*.{ts,tsx}", "packages/web/src/domain.ts"],
    rules: {
      "no-restricted-imports": restrictedImports(
        { group: ["~io/**", "~state/**", "../io/**", "../state/**"], message: "web domain must stay independent from io and state." }
      )
    }
  },
  {
    files: ["packages/web/src/io/**/*.{ts,tsx}", "packages/web/src/io.ts"],
    rules: {
      "no-restricted-imports": restrictedImports(
        { group: ["~state/**", "~app/**", "../state/**", "../app/**"], message: "web io may depend on domain only, not state or app." }
      )
    }
  },
  {
    files: ["packages/web/src/state/**/*.{ts,tsx}", "packages/web/src/state.ts"],
    rules: {
      "no-restricted-imports": restrictedImports(
        { group: ["~app/**", "../app/**"], message: "web state must not depend on app." }
      )
    }
  },
  {
    files: ["packages/web/src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports()
    }
  },

  // ── 6. Path 규칙 (auto-fixable) ───────────────────────────────
  // runtime + server 동일 적용. 새 alias 추가 시 RUNTIME_ALIASES / SERVER_ALIASES
  // 와 해당 패키지 tsconfig.json paths 모두 업데이트해야 한다.
  {
    files: ["packages/runtime/src/**/*.{ts,tsx}"],
    plugins: { local: localPlugin },
    rules: {
      "local/require-js-extension": "error",
      "local/no-deep-relative-import": ["error", { aliases: RUNTIME_ALIASES }],
      "local/prefer-barrel-index": ["error", { aliases: RUNTIME_ALIASES }]
    }
  },
  // 모든 server 패키지: .js 확장자 + barrel index 강제 (alias 무관, 상대경로도 검사)
  {
    files: ["packages/server/*/src/**/*.{ts,tsx}"],
    plugins: { local: localPlugin },
    rules: {
      "local/require-js-extension": "error",
      "local/prefer-barrel-index": ["error", { aliases: SERVER_ALIASES }]
    }
  },
  // no-deep-relative-import 는 ~alias 를 가진 api-gateway 에만 적용한다.
  // 컨텍스트 패키지는 모듈 내부 상대 import(../../domain 등)를 정상 패턴으로 쓰므로 제외.
  {
    files: ["packages/server/api-gateway/src/**/*.{ts,tsx}"],
    plugins: { local: localPlugin },
    rules: {
      "local/no-deep-relative-import": ["error", { aliases: SERVER_ALIASES }]
    }
  },
  {
    files: ["packages/web/src/**/*.{ts,tsx}"],
    plugins: { local: localPlugin },
    rules: {
      "local/require-js-extension": "error",
      "local/no-deep-relative-import": ["error", { aliases: WEB_ALIASES }],
      "local/prefer-barrel-index": ["error", { aliases: WEB_ALIASES }]
    }
  },

  // ── 7. RELAXATIONS — 외부 라이브러리/프레임워크 한계 우회 ──────
  // 모든 항목은 사유와 함께 명시. runtime 에는 어떤 완화도 적용되지 않는다.

  // 7-a) NestJS DI 한계 — type erasure 로 인한 광범위 no-unsafe-* false positive.
  //      적용 범위: api-gateway 합성 루트(gateway.entry + main + mcp) +
  //      NestJS 데코레이터를 직접 쓰는 컨텍스트 코드 (controllers, mcp, ws-gateway, llm runner).
  //      `require-await: off` 는 pass-through async API 통일성을 위함.
  //      컨텍스트 usecase/service 는 완화 없이 baseline 을 그대로 통과하므로 포함하지 않는다.
  {
    files: [
      "packages/server/api-gateway/src/gateway.entry.ts",
      "packages/server/api-gateway/src/main/**/*.{ts,tsx}",
      "packages/server/api-gateway/src/mcp/**/*.{ts,tsx}",
      "packages/server/*/src/**/api/**/*.controller.{ts,tsx}",
      "packages/server/*/src/**/mcp/**/*.{ts,tsx}",
      "packages/server/ws-gateway/src/**/*.{ts,tsx}",
      "packages/server/shared/src/llm/**/*.{ts,tsx}"
    ],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off"
    }
  },

  // 7-b) NestJS DI — controller 는 service 클래스를 런타임 값(토큰)으로 받아야 하므로
  //      type-only import 강제를 끈다. 모든 controller 에 일괄 적용해
  //      신규 controller 작성 시 동일 footgun 을 방지한다.
  {
    files: ["packages/server/*/src/**/api/**/*.controller.{ts,tsx}"],
    rules: { "@typescript-eslint/consistent-type-imports": "off" }
  },

  // ── 8. 모든 test 파일 ─────────────────────────────────────────
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**/*.ts", "**/test/**/*.tsx"],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off"
    }
  }
);
