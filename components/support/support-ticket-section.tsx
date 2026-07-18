import { getEffectiveSession } from "@/lib/auth-effective";
import { SupportTicketWidget } from "./support-ticket-widget";

const STAFF_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]);

/** DGsmart support-ticket card — dashboards only, company staff roles only. */
export async function SupportTicketSection() {
  // Hide entirely until the ticketing source is configured.
  if (!process.env.TICKETING_URL || !process.env.TICKETING_PROJECT_CODE || !process.env.TICKETING_API_KEY) {
    return null;
  }
  const session = await getEffectiveSession();
  if (!session || !STAFF_ROLES.has(session.real.role)) return null;
  return <SupportTicketWidget userName={session.user.name ?? session.user.email} />;
}
