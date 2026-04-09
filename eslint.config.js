import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
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
            group: ["**/infrastructure/sqlite/index.js"],
            message: "Import from the sqlite barrel path instead of '/index.js'."
          },
          {
            group: ["**/infrastructure/sqlite/*.js"],
            message: "Import sqlite symbols from the sqlite barrel."
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
