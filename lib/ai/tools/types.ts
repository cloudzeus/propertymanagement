import type { z } from "zod";
import type { PageContext } from "@/lib/ai/assistant/page-context";

/** Everything a tool may know about the caller. Built once per turn, server-side, from the effective session. */
export type AssistantCtx = {
  user: { id: string; name: string | null; email: string; role: string; customerId: string | null; companyId: string | null };
  real: { id: string; role: string };
  impersonating: boolean;
  surface: "company" | "customer" | "marketplace";
  perms: Set<string>;
  scope: {
    seesAllCustomers: boolean;
    managerBuildingIds: string[];
    occupantUnits: { unitId: string; unitNumber: string; buildingId: string; buildingName: string; role: "OWNER" | "RESIDENT" }[];
    supplierId: string | null;
  };
  page: PageContext & { buildingName?: string };
  now: Date;
};

export type ToolResult = { ok: true; data: unknown; note?: string } | { ok: false; error: string };

export type ReadTool<A> = {
  name: string; description: string; kind: "read"; roles: readonly string[]; schema: z.ZodType<A>; label: string;
  run(args: A, ctx: AssistantCtx): Promise<ToolResult>;
};

export type WritePreview = { title: string; summaryLines: string[]; warnings: string[]; resolved: Record<string, unknown>; buildingId: string | null };
export type ExecuteResult = { ok: true; message: string; href?: string } | { ok: false; error: string };

export type WriteTool<A> = {
  name: string; description: string; kind: "write"; roles: readonly string[]; requiredPerm?: string; schema: z.ZodType<A>; label: string;
  preview(args: A, ctx: AssistantCtx): Promise<WritePreview | { error: string }>;
  execute(resolved: Record<string, unknown>, ctx: AssistantCtx): Promise<ExecuteResult>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AssistantTool = ReadTool<any> | WriteTool<any>;

export type WikiHit = { slug: string; title: string; heading: string | null; route: string | null; content: string; score?: number };

export const ACCESS_DENIED = "Δεν έχετε πρόσβαση";
