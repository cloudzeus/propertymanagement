"use client";

import { RiAlarmWarningLine, RiHome4Line, RiPriceTag3Line, RiCalendarTodoLine } from "react-icons/ri";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, type FaultStatus, type FaultPriority } from "@/lib/maintenance-shared";
import { NewRequestButton } from "@/components/maintenance/new-request-form";
import type { BuildingCaps } from "@/lib/building-caps";

export type RequestRow = {
  id: string; title: string; status: string; priority: string;
  createdAt: string; scheduledDate: string | null;
  unitNumber: string | null; categoryName: string | null;
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "#c50f1f", HIGH: "#CA5D00", NORMAL: "#0078D4", LOW: "#707070",
};

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("el-GR", { day: "2-digit", month: "short", year: "numeric" });
}

export function RequestsPanel({ buildingId, buildingName, units, requests, categories, can }: {
  buildingId: string;
  buildingName: string;
  units: { id: string; unitNumber: string }[];
  requests: RequestRow[];
  categories: { id: string; name: string }[];
  can: BuildingCaps;
}) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
          Αιτήματα βλαβών{requests.length ? ` (${requests.length})` : ""}
        </span>
        {can.createRequests && (
          <NewRequestButton
            buildings={[{ id: buildingId, name: buildingName, units: units.map((u) => ({ id: u.id, label: u.unitNumber })) }]}
            categories={categories}
            detailBase="/portal/requests"
          />
        )}
      </div>
      <div style={{ padding: 16 }}>
        {requests.length === 0 ? (
          <div style={{ padding: "28px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            <RiAlarmWarningLine style={{ fontSize: 26, marginBottom: 6 }} />
            <div>Δεν υπάρχουν αιτήματα βλαβών για αυτό το κτήριο.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {requests.map((r) => {
              const statusColor = STATUS_COLORS[r.status as FaultStatus] ?? "#6b7280";
              const statusLabel = STATUS_LABELS[r.status as FaultStatus] ?? r.status;
              const prColor = PRIORITY_COLORS[r.priority] ?? PRIORITY_COLORS.NORMAL;
              const prLabel = PRIORITY_LABELS[r.priority as FaultPriority] ?? r.priority;
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{r.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--muted-foreground)", marginTop: 3, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <RiHome4Line /> {r.unitNumber ? `Μονάδα ${r.unitNumber}` : "Κοινόχρηστος χώρος"}
                      </span>
                      {r.categoryName && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><RiPriceTag3Line /> {r.categoryName}</span>
                      )}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <RiCalendarTodoLine /> {fmtDay(r.createdAt)}
                      </span>
                      {r.scheduledDate && <span>Προγραμματισμένο: {fmtDay(r.scheduledDate)}</span>}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: `${prColor}18`, color: prColor }}>{prLabel}</span>
                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: `${statusColor}18`, color: statusColor }}>{statusLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
