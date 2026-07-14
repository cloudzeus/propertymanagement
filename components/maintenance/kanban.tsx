"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { STATUS_LABELS, STATUS_COLORS, STATUS_TRANSITIONS, PRIORITY_LABELS, type FaultStatus } from "@/lib/maintenance-shared";
import { changeRequestStatus } from "@/app/actions/maintenance-requests";
import { RiAlarmWarningLine, RiUserLine, RiBuilding2Line } from "react-icons/ri";
import type { FaultListItem } from "./types";

const COLUMNS: FaultStatus[] = ["OPEN", "ACKNOWLEDGED", "SCHEDULED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"];

function Card({ item, detailBase, dragging = false }: { item: FaultListItem; detailBase: string; dragging?: boolean }) {
  const overdue = item.slaDueAt && new Date(item.slaDueAt) < new Date() && !["COMPLETED", "CANCELLED"].includes(item.status);
  const pr = item.priority as keyof typeof PRIORITY_LABELS;
  const prColor = pr === "URGENT" ? "#9f1239" : pr === "HIGH" ? "#b45309" : "var(--muted-foreground)";
  return (
    <div style={{
      background: "var(--card)", border: `1px solid ${overdue ? "#9f123960" : "var(--border)"}`,
      borderRadius: "var(--radius-sm)", padding: "8px 10px", fontSize: 12.5,
      boxShadow: dragging ? "0 8px 20px rgba(0,0,0,.18)" : "0 1px 2px rgba(0,0,0,.05)",
      cursor: "grab", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <Link href={`${detailBase}/${item.id}`} onClick={(e) => e.stopPropagation()}
        style={{ fontWeight: 600, color: "var(--foreground)", textDecoration: "none", lineHeight: 1.3 }}>
        {item.title}
      </Link>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--muted-foreground)", fontSize: 11.5 }}>
        <RiBuilding2Line /> {item.buildingName}{item.unitLabel ? ` · ${item.unitLabel}` : ""}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
        <span style={{ fontWeight: 700, color: prColor }}>{PRIORITY_LABELS[pr] ?? item.priority}</span>
        {item.assigneeName && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--muted-foreground)" }}>
            <RiUserLine /> {item.assigneeName}
          </span>
        )}
        {overdue && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#9f1239", fontWeight: 700 }}>
            <RiAlarmWarningLine /> SLA
          </span>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ item, detailBase }: { item: FaultListItem; detailBase: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.35 : 1 }}>
      <Card item={item} detailBase={detailBase} />
    </div>
  );
}

function Column({ status, items, detailBase }: { status: FaultStatus; items: FaultListItem[]; detailBase: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = STATUS_COLORS[status];
  return (
    <div ref={setNodeRef} style={{
      flex: "1 1 0", minWidth: 210, display: "flex", flexDirection: "column", gap: 8,
      background: isOver ? `${color}0d` : "var(--bg-canvas)",
      border: `1px solid ${isOver ? `${color}55` : "var(--border)"}`,
      borderRadius: "var(--radius-lg)", padding: 10, transition: "background .12s, border-color .12s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>{STATUS_LABELS[status]}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginLeft: "auto" }}>{items.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 40 }}>
        {items.map((i) => <DraggableCard key={i.id} item={i} detailBase={detailBase} />)}
      </div>
    </div>
  );
}

/** Kanban βλαβών για τα dashboards — drag & drop κάρτας σε στήλη = αλλαγή κατάστασης. */
export function MaintenanceKanban({ items: initial, detailBase }: { items: FaultListItem[]; detailBase: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const target = e.over ? (String(e.over.id) as FaultStatus) : null;
    if (!target) return;
    const item = items.find((i) => i.id === id);
    if (!item || item.status === target) return;
    if (!STATUS_TRANSITIONS[item.status as FaultStatus]?.includes(target)) {
      setError(`Μη επιτρεπτή μετάβαση: «${STATUS_LABELS[item.status as FaultStatus]}» → «${STATUS_LABELS[target]}»`);
      return;
    }
    setError(null);
    const prev = items;
    setItems((p) => p.map((i) => (i.id === id ? { ...i, status: target } : i)));
    const res = await changeRequestStatus(id, target);
    if ("error" in res && res.error) { setItems(prev); setError(res.error); return; }
    router.refresh();
  }

  const active = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {error && <div style={{ fontSize: 12.5, color: "var(--destructive)" }}>{error}</div>}
      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {COLUMNS.map((s) => (
            <Column key={s} status={s} items={items.filter((i) => i.status === s)} detailBase={detailBase} />
          ))}
        </div>
        <DragOverlay>{active ? <Card item={active} detailBase={detailBase} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
