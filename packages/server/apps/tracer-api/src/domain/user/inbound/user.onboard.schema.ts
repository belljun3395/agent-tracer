import { z } from "zod";

export const onboardingBodySchema = z.object({ email: z.string().trim().email() });

export type OnboardingBody = z.infer<typeof onboardingBodySchema>;
