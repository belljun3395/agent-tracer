import type { OnboardingResult } from "~web/entities/user/model/user.js";
import { postJson } from "~web/shared/api/client/json-methods.js";
import { setUserIdentity } from "~web/shared/api/user-identity.js";

/** 이메일 온보딩 응답의 신원을 브라우저 세션에 반영한다. */
export async function onboardUser(email: string): Promise<OnboardingResult> {
  const result = await postJson<OnboardingResult>("/api/v1/users/onboarding", {
    email,
  });
  setUserIdentity(result.userId, result.email);
  return result;
}
