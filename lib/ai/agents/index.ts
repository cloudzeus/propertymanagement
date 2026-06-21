import { buildingOnboardingAgent } from "./building-onboarding";

export type AgentTool = { name: string; description: string; parameters: object };
export type AgentDefinition = { system: string; tools: AgentTool[] };

const REGISTRY: Record<string, AgentDefinition> = {
  "building-onboarding": buildingOnboardingAgent,
};

export function getAgent(key: string): AgentDefinition | null {
  return REGISTRY[key] ?? null;
}
