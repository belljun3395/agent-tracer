import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  EMBEDDING_MODEL,
  hasLocalEmbeddingModel,
  MODEL_DIR
} from "../../src/infrastructure/embedding/embedding-service.js";

describe("embedding service configuration", () => {
  it("resolves the bundled local model directory", () => {
    expect(hasLocalEmbeddingModel()).toBe(true);
    expect(fs.existsSync(path.join(MODEL_DIR, EMBEDDING_MODEL, "tokenizer.json"))).toBe(true);
  });
});
