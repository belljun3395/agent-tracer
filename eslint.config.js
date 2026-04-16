import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/*.d.ts.map",
      "**/*.js.map"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{js,jsx}"],
    ...tseslint.configs.disableTypeChecked
  },
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
        "varsIgnorePattern": "^_",
        "argsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }]
    }
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["./**/index.js", "../**/index.js"],
            message: "Import the directory barrel path instead of '/index.js'."
          }
        ]
      }]
    }
  },
  {
    files: ["packages/core/src/**/*.{ts,tsx}", "packages/core/test/**/*.{ts,tsx}"],
    ignores: [
      "packages/core/src/index.ts",
      "packages/core/src/classification.ts",
      "packages/core/src/domain.ts",
      "packages/core/src/interop.ts",
      "packages/core/src/paths.ts",
      "packages/core/src/runtime.ts",
      "packages/core/src/workflow.ts"
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["./**/index.js", "../**/index.js"],
            message: "Import the directory barrel path instead of '/index.js'."
          },
          {
            group: [
              "**/classification/*.js",
              "**/domain/*.js",
              "**/interop/*.js",
              "**/paths/*.js",
              "**/runtime/*.js",
              "**/workflow/*.js"
            ],
            message: "Import from the nearest core module barrel (for example '../domain.js') instead of a deep module file."
          }
        ]
      }]
    }
  },
  {
    files: ["packages/mcp/src/**/*.{ts,tsx}", "packages/mcp/test/**/*.{ts,tsx}"],
    ignores: ["packages/mcp/src/tools.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["./**/index.js", "../**/index.js"],
            message: "Import the directory barrel path instead of '/index.js'."
          },
          {
            group: ["**/tools/*.js"],
            message: "Import from the tools barrel instead of a deep tools module when crossing directories."
          }
        ]
      }]
    }
  },
  {
    files: ["packages/server/src/infrastructure/sqlite/**/*.ts"],
    rules: {
      "@typescript-eslint/require-await": "off"
    }
  },
  {
    files: ["packages/server/**/*.{ts,tsx}"],
    ignores: ["packages/server/src/infrastructure/sqlite/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["./**/index.js", "../**/index.js"],
            message: "Import the directory barrel path instead of '/index.js'."
          },
          {
            group: ["**/application/ports/*.js"],
            message: "Import application ports from the ports barrel."
          },
          {
            group: ["**/infrastructure/sqlite/*.js"],
            message: "Import sqlite symbols from the sqlite barrel."
          },
          {
            group: ["**/infrastructure/embedding/*.js"],
            message: "Import embedding symbols from the embedding barrel."
          }
        ]
      }]
    }
  },
  {
    files: ["packages/web-domain/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "react",
              "react-dom",
              "react/*",
              "react-dom/*",
              "zustand",
              "zustand/*",
              "@tanstack/*",
              "react-router-dom",
              "@monitor/web-io",
              "@monitor/web-state",
              "@monitor/web"
            ],
            message: "web-domain must stay framework-free — depend only on @monitor/core."
          }
        ]
      }]
    }
  },
  {
    files: ["packages/web-io/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "react",
              "react-dom",
              "react/*",
              "react-dom/*",
              "zustand",
              "zustand/*",
              "@tanstack/*",
              "react-router-dom",
              "@monitor/web-state",
              "@monitor/web"
            ],
            message: "web-io is the browser-boundary adapter layer — no React, no state libs, no upward imports."
          }
        ]
      }]
    }
  },
  {
    files: ["packages/web-state/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@monitor/web"],
            message: "web-state must not import from web."
          }
        ]
      }]
    }
  },
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
