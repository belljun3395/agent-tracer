/**
 * @module infrastructure/sqlite/sqlite-rules-catalog
 *
 * IRulesCatalog 구현 - 파일 시스템 기반 규칙 색인.
 */

import { loadRulesIndex, type RulesIndex } from "@monitor/core";

import type { IRulesCatalog } from "../../application/ports/rules-catalog.js";

export class SqliteRulesCatalog implements IRulesCatalog {
  #index: RulesIndex;

  constructor(private readonly rulesDir: string) {
    this.#index = loadRulesIndex(rulesDir);
  }

  getIndex(): RulesIndex {
    return this.#index;
  }

  reload(): RulesIndex {
    this.#index = loadRulesIndex(this.rulesDir);
    return this.#index;
  }
}
