import type { HeatingType } from "@/lib/ai/agents/building-onboarding";

export type OnboardingInput = { address: string; totalApartments: number; heatingType: HeatingType; managerName: string };

/** Pure: turn validated onboarding data into create payloads. No server deps. */
export function buildOnboardingPayload(input: OnboardingInput) {
  const units = Array.from({ length: input.totalApartments }, (_, i) => ({ unitNumber: String(i + 1) }));
  return {
    building: { name: input.address, address: input.address },
    units,
    meteredHeating: input.heatingType === "AUTONOMOUS_METERS",
    managerName: input.managerName,
  };
}
