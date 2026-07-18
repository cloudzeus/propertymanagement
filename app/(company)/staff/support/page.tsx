import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getEffectiveSession } from "@/lib/auth-effective";
import { SupportTicketSection } from "@/components/support/support-ticket-section";
import {
  RiCustomerService2Line,
  RiExternalLinkLine,
  RiCheckboxCircleLine,
  RiTimeLine,
  RiQuestionAnswerLine,
} from "react-icons/ri";

export const dynamic = "force-dynamic";

const STAFF_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]);

interface RemoteStatus {
  status: string;
  statusLabel: string;
  assignee?: string | { name?: string } | null;
  assigneeName?: string | null;
  events?: { type: string; label?: string; at: string }[];
}

/** Assigned engineer's name, from whichever field fluent-pm exposes it in. */
function assigneeOf(remote: RemoteStatus | null): string | null {
  if (!remote) return null;
  if (typeof remote.assignee === "string" && remote.assignee) return remote.assignee;
  if (remote.assignee && typeof remote.assignee === "object" && remote.assignee.name) return remote.assignee.name;
  if (remote.assigneeName) return remote.assigneeName;
  // Fallback: assignment event label, e.g. "Ανατέθηκε: Γιώργος" / "Ανατέθηκε στον Γιώργο"
  const ev = remote.events?.findLast((e) => e.label?.startsWith("Ανατέθηκε"));
  const m = ev?.label?.match(/^Ανατέθηκε(?::| σ(?:τον|την|ε))\s+(.+)$/);
  return m ? m[1] : null;
}

async function fetchStatus(code: string, token: string): Promise<RemoteStatus | null> {
  const base = process.env.TICKETING_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/tickets/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const STATUS_COLOR: Record<string, string> = {
  closed: "var(--color-success)",
  resolved: "var(--color-success)",
  converted: "var(--color-primary)",
  needs_info: "var(--color-warning)",
  open: "var(--color-warning)",
};

function statusIcon(status: string): React.ElementType {
  if (status === "closed" || status === "resolved") return RiCheckboxCircleLine;
  if (status === "needs_info") return RiQuestionAnswerLine;
  return RiTimeLine;
}

export default async function SupportTicketsPage() {
  const session = await getEffectiveSession();
  if (!session) redirect("/login");
  if (!STAFF_ROLES.has(session.real.role)) redirect("/unauthorized");

  const tickets = await db.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { createdBy: { select: { name: true, email: true } } },
  });

  const statuses = await Promise.all(tickets.map((t) => fetchStatus(t.code, t.publicToken)));
  const base = process.env.TICKETING_URL ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <RiCustomerService2Line style={{ color: "var(--color-primary)" }} /> Αιτήματα Υποστήριξης
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
          Η πορεία των αιτημάτων της ομάδας προς την υποστήριξη DGsmart
        </p>
      </div>

      <SupportTicketSection />

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        {tickets.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            <RiCustomerService2Line style={{ fontSize: 32, opacity: 0.4, display: "block", margin: "0 auto 8px" }} />
            Δεν έχουν υποβληθεί αιτήματα ακόμη
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tickets.map((t, i) => {
              const remote = statuses[i];
              const status = remote?.status ?? "";
              const label = remote?.statusLabel ?? "—";
              const color = STATUS_COLOR[status] ?? "var(--muted-foreground)";
              const Icon = statusIcon(status);
              const lastEvent = remote?.events?.length ? remote.events[remote.events.length - 1] : null;
              const assignee = assigneeOf(remote);
              return (
                <a
                  key={t.id}
                  href={`${base}/t/${t.publicToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", background: "var(--bg-canvas)", borderRadius: 6, textDecoration: "none",
                  }}
                >
                  <Icon style={{ fontSize: 18, color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.subject}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600 }}>{t.code}</span>
                      <span>{t.createdBy?.name ?? t.createdBy?.email ?? "—"}</span>
                      <span>{new Date(t.createdAt).toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                      {assignee && <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Μηχανικός: {assignee}</span>}
                      {lastEvent?.label && <span>· {lastEvent.label}</span>}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                    background: `color-mix(in srgb, ${color} 12%, transparent)`, color,
                  }}>
                    {label}
                  </span>
                  <RiExternalLinkLine style={{ fontSize: 15, color: "var(--muted-foreground)", flexShrink: 0 }} />
                </a>
              );
            })}
          </div>
        )}
      </div>

      <Link href="/staff" style={{ fontSize: 13, color: "var(--color-primary)", textDecoration: "none" }}>
        ← Πίσω στο dashboard
      </Link>
    </div>
  );
}
