import { headers } from "next/headers";
import { db } from "@/lib/db";
import { RiCheckboxCircleFill, RiErrorWarningLine, RiCheckLine } from "react-icons/ri";

export const metadata = { title: "Επιβεβαίωση ανακοίνωσης" };

function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("cf-connecting-ip") || h.get("x-real-ip") || "unknown";
}

async function acknowledge(token: string) {
  "use server";
  const h = await headers();
  const ip = clientIp(h);
  const ua = h.get("user-agent") || "unknown";
  const rec = await db.announcement_User.findUnique({ where: { token }, select: { id: true, acknowledgedAt: true } });
  if (rec && !rec.acknowledgedAt) {
    await db.announcement_User.update({
      where: { id: rec.id },
      data: { acknowledgedAt: new Date(), ipAddress: ip, userAgent: ua, readAt: new Date() },
    });
  }
}

export default async function AcknowledgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const rec = await db.announcement_User.findUnique({
    where: { token },
    select: {
      acknowledgedAt: true,
      user: { select: { name: true } },
      announcement: { select: { title: true, content: true, building: { select: { name: true } } } },
    },
  });

  if (!rec) {
    return (
      <Shell>
        <RiErrorWarningLine style={{ fontSize: 48, color: "#dc2626" }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "16px 0 6px" }}>Μη έγκυρος σύνδεσμος</h1>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>Ο σύνδεσμος επιβεβαίωσης δεν είναι έγκυρος ή έχει λήξει.</p>
      </Shell>
    );
  }

  const acked = Boolean(rec.acknowledgedAt);
  const ackAction = acknowledge.bind(null, token);

  return (
    <Shell>
      <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Ανακοίνωση — {rec.announcement.building?.name ?? "—"}</p>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 16px", color: "#1a1a1a" }}>{rec.announcement.title}</h1>
      <div style={{ textAlign: "left", border: "1px solid #e5e5e5", borderRadius: 8, padding: 16, background: "#fafafa", fontSize: 14, lineHeight: 1.6, color: "#1a1a1a" }}
        dangerouslySetInnerHTML={{ __html: rec.announcement.content }} />

      {acked ? (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <RiCheckboxCircleFill style={{ fontSize: 44, color: "#16a34a" }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: "#16a34a" }}>Λάβατε γνώση</div>
          <div style={{ fontSize: 12, color: "#999" }}>Καταχωρήθηκε: {rec.acknowledgedAt!.toLocaleString("el-GR")}</div>
        </div>
      ) : (
        <form action={ackAction} style={{ marginTop: 24 }}>
          <button type="submit" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#c50f1f", color: "#fff", border: "none", padding: "12px 32px", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            <RiCheckLine /> Έλαβα γνώση
          </button>
          <p style={{ fontSize: 12, color: "#999", marginTop: 12 }}>Πατώντας το κουμπί επιβεβαιώνετε ότι λάβατε γνώση. Καταχωρείται η ημερομηνία/ώρα και η διεύθυνση IP σας.</p>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "#f4f4f5", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 600, width: "100%", background: "#fff", borderRadius: 12, padding: "40px 32px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,.08)" }}>
        {children}
      </div>
    </div>
  );
}
