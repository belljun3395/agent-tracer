import { z } from "zod";
import { UNKNOWN_CONTRACT_VERSION } from "./contract.version.const.js";

/** 인제스트 봉투가 싣는 데몬 계약 버전이며, 없거나 형식이 어긋나면 unknown으로 정규화한다. */
export const contractVersionFieldSchema = z.string().trim().min(1).optional()
    .transform((value) => value ?? UNKNOWN_CONTRACT_VERSION);
