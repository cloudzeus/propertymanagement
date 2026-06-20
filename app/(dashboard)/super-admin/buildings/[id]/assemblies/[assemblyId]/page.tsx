import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { getAssemblyCost } from "@/app/actions/assemblies";
import { AssemblyRoom } from "./AssemblyRoom";
import { MinutesEditor } from "./MinutesEditor";

export const metadata = { title: "Γενική Συνέλευση — Super Admin" };

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Προγραμματισμένη",
  LIVE: "Σε εξέλιξη",
  ENDED: "Ολοκληρώθηκε",
  DRAFT_READY: "Πρόχειρα πρακτικά",
  APPROVED: "Εγκρίθηκε",
  SENT: "Απεστάλη",
};

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"];

export default async function AssemblyDetailPage({ params }: { params: Promise<{ id: string; assemblyId: string }> }) {
  const { assemblyId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  const isStaff = STAFF_ROLES.includes(me?.role ?? "");

  const assembly = await db.assembly.findUnique({
    where: { id: assemblyId },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledAt: true,
      buildingId: true,
      minutesDraft: true,
      minutesFinal: true,
      participants: { select: { id: true, displayName: true, durationSeconds: true, momSentAt: true } },
    },
  });
  if (!assembly) notFound();

  const cost = await getAssemblyCost(assemblyId);

  const inRoom = assembly.status === "SCHEDULED" || assembly.status === "LIVE";
  const hasMinutes = !!assembly.minutesDraft && ["DRAFT_READY", "APPROVED", "SENT"].includes(assembly.status);

  const cardStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: 20,
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>{assembly.title}</h1>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 9999, background: "var(--bg-canvas)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
            {STATUS_LABEL[assembly.status] ?? assembly.status}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>
          {assembly.scheduledAt.toLocaleString("el-GR")}
        </div>
      </div>

      {/* Room (audio + live transcription) */}
      {inRoom && <AssemblyRoom assemblyId={assembly.id} isStaff={isStaff} />}

      {/* Minutes editor */}
      {hasMinutes && (
        <MinutesEditor
          assemblyId={assembly.id}
          initialHtml={assembly.minutesFinal ?? assembly.minutesDraft ?? ""}
          readonly={assembly.status === "SENT"}
        />
      )}

      {/* Cost breakdown */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Κόστος υπηρεσιών</h2>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)" }}>{cost.total.toFixed(2)} €</span>
        </div>
        {cost.byApi.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Δεν υπάρχει καταγεγραμμένο κόστος ακόμη.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted-foreground)" }}>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Υπηρεσία</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Μονάδες</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Tokens</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Κόστος</th>
              </tr>
            </thead>
            <tbody>
              {cost.byApi.map((r) => (
                <tr key={r.apiName} style={{ borderTop: "1px solid var(--border)", color: "var(--foreground)" }}>
                  <td style={{ padding: "8px" }}>{r.apiName}</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>{r.units}</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>{r.tokens}</td>
                  <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>{r.cost.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
