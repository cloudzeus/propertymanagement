import type { AssistantCtx } from "../types";

export const STAFF = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const;
export const STAFF_AND_MANAGER = [...STAFF, "PROPERTY_ADMIN"] as const;

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const toParagraphs = (text: string) => "<p>" + escapeHtml(text.trim()).split(/\n+/).map((l) => l.trim()).filter(Boolean).join("</p><p>") + "</p>";
export const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const norm = (s: string) => s.toLowerCase().trim();

/** Where the user lands after a building-scoped action. */
export function buildingHref(ctx: AssistantCtx, buildingId: string, section: "communication" | "finance" | "maintenance"): string {
  return ctx.surface === "company" ? `/super-admin/buildings/${buildingId}` : `/building/${buildingId}?s=${section}`;
}
