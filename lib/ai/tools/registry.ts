import { z } from "zod";
import { can } from "@/lib/rbac/permissions-core";
import type { RbacAction } from "@/lib/rbac/types";
import type { AgentTool } from "@/lib/ai/agents";
import type { AssistantTool } from "./types";
import { listMyBuildings } from "./read/my-buildings";
import { getBuildingOverview } from "./read/building-overview";
import { listFaults } from "./read/faults";
import { listAnnouncements } from "./read/announcements";
import { getMyBalance } from "./read/my-balance";
import { listExpenses } from "./read/expenses";
import { listCalendarTasks } from "./read/calendar-tasks";
import { listPendingWork } from "./read/pending-work";
import { searchWiki } from "./read/wiki-search";
import { createFaultReport } from "./write/create-fault";
import { createAnnouncement } from "./write/create-announcement";
import { createBuildingExpense } from "./write/create-expense";
import { createRecurringTask } from "./write/create-recurring-task";
import { createRfq } from "./write/create-rfq";

/** Every assistant tool. Order = order shown to the model. */
export const TOOLS: AssistantTool[] = [
  listMyBuildings, getBuildingOverview, listFaults, listAnnouncements, getMyBalance, listExpenses, listCalendarTasks, listPendingWork, searchWiki,
  createFaultReport, createAnnouncement, createBuildingExpense, createRecurringTask, createRfq,
];

/** Tools the role may see: role list (empty = all) AND optional "module:action" permission. */
export function toolsForRole(role: string, perms: Set<string>, tools: readonly AssistantTool[] = TOOLS): AssistantTool[] {
  return tools.filter((t) => {
    if (t.roles.length && !t.roles.includes(role)) return false;
    if (t.requiredPerm) {
      const [mod, action] = t.requiredPerm.split(":");
      if (!can(perms, mod, action as RbacAction)) return false;
    }
    return true;
  });
}

export function toAgentTools(tools: readonly AssistantTool[]): AgentTool[] {
  return tools.map((t) => ({ name: t.name, description: t.description, parameters: z.toJSONSchema(t.schema as z.ZodType) }));
}

export function findTool(name: string): AssistantTool | undefined {
  return TOOLS.find((t) => t.name === name);
}

export { TOOL_LABELS } from "./labels";
