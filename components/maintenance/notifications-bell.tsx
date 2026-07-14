"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiNotification3Line, RiCheckDoubleLine } from "react-icons/ri";
import { markNotificationRead, markAllNotificationsRead } from "@/app/actions/maintenance-requests";

type Item = { id: string; type: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };

const fmt = (iso: string) => new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" });

/** Καμπανάκι ειδοποιήσεων — polling κάθε 60". */
export function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items ?? []);
      setUnread(json.unread ?? 0);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function onItemClick(n: Item) {
    setOpen(false);
    if (!n.readAt) { await markNotificationRead(n.id); load(); }
    if (n.href) router.push(n.href);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} aria-label="Ειδοποιήσεις" style={{
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
        width: 36, height: 36, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
        background: "var(--card)", cursor: "pointer", color: "var(--foreground)",
      }}>
        <RiNotification3Line style={{ fontSize: 17 }} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px",
            borderRadius: 999, background: "var(--destructive, #b91c1c)", color: "#fff",
            fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: 42, width: 360, maxHeight: 440, overflowY: "auto", zIndex: 500,
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card, 0 8px 24px rgba(0,0,0,.12))",
        }}>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
            <strong style={{ fontSize: 13, color: "var(--foreground)", flex: 1 }}>Ειδοποιήσεις</strong>
            {unread > 0 && (
              <button onClick={async () => { await markAllNotificationsRead(); load(); }} style={{
                display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none",
                fontSize: 12, color: "var(--muted-foreground)", cursor: "pointer",
              }}>
                <RiCheckDoubleLine /> Όλα ως αναγνωσμένα
              </button>
            )}
          </div>
          {items.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "var(--muted-foreground)" }}>Δεν υπάρχουν ειδοποιήσεις.</div>}
          {items.map((n) => (
            <button key={n.id} onClick={() => onItemClick(n)} style={{
              display: "block", width: "100%", textAlign: "left", padding: "10px 14px", cursor: "pointer",
              border: "none", borderBottom: "1px solid var(--border)",
              background: n.readAt ? "var(--card)" : "var(--paper)",
            }}>
              <div style={{ fontSize: 13, fontWeight: n.readAt ? 500 : 700, color: "var(--foreground)" }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.body}</div>}
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>{fmt(n.createdAt)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
