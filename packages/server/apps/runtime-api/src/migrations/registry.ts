import { InitLedger1783960000000 } from "./0001-InitLedger.js";
import { DisableLedgerPartitionRetention1784170000000 } from "./0002-DisableLedgerPartitionRetention.js";

/** 원장 스키마의 마이그레이션 순서다. */
export const RUNTIME_MIGRATIONS = [InitLedger1783960000000, DisableLedgerPartitionRetention1784170000000] as const;
