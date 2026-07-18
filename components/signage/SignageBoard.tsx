"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SignageData } from "@/lib/signage/data";
import { AutoRefresh } from "@/components/realtime/AutoRefresh";

// Orithon token values on dark ink (#15161a): cream #F6F4EC text, amber #F2A23C accent.
const CREAM = "#F6F4EC";
const AMBER = "#F2A23C";
const MUTED = "rgba(246,244,236,.62)";
const CARD_BG = "rgba(246,244,236,.06)";
const CARD_BORDER = "1px solid rgba(246,244,236,.14)";

const card: React.CSSProperties = {
  background: CARD_BG,
  border: CARD_BORDER,
  borderRadius: 22,
  padding: 32,
};

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "long" });
}

function fmtFull(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" })} · ${d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function SignageBoard({
  data,
  weather,
}: {
  data: SignageData;
  weather: { temp: number; label: string } | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null); // null until mounted → no hydration mismatch
  const [idx, setIdx] = useState(0);

  // 1s clock
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 12s announcement rotation
  const annCount = data.announcements.length;
  useEffect(() => {
    if (annCount < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % annCount), 12000);
    return () => clearInterval(t);
  }, [annCount]);

  // 5-min polling fallback — realtime SSE (AutoRefresh) is the primary refresh path.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 300000);
    return () => clearInterval(t);
  }, [router]);

  const ann = annCount > 0 ? data.announcements[idx % annCount] : null;
  const marquee = data.contacts.length > 4;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 32,
        padding: 48,
        cursor: "none",
        overflow: "hidden",
      }}
    >
      <AutoRefresh buildingId={data.building.id} />
      {/* ── Header: building · weather + clock ─────────────────────────── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>
            {data.building.name}
          </div>
          <div style={{ fontSize: 22, color: MUTED, marginTop: 6 }}>
            {data.building.address}, {data.building.city}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {now ? now.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
          </div>
          <div style={{ fontSize: 22, color: MUTED, marginTop: 6 }}>
            {now ? now.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" }) : " "}
            {weather ? (
              <span style={{ marginLeft: 16, color: CREAM }}>
                <span style={{ fontWeight: 700 }}>{weather.temp}°C</span>
                {weather.label ? <span style={{ color: MUTED }}> {weather.label}</span> : null}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── Main: rotating announcement + info column ───────────────────── */}
      <main style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 32, minHeight: 0 }}>
        <section style={{ ...card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: AMBER }}>
            Ανακοινώσεις
          </div>
          {ann ? (
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", marginTop: 20 }}>
              {ann.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ann.imageUrl}
                  alt=""
                  style={{ maxHeight: 240, width: "100%", objectFit: "cover", borderRadius: 18, marginBottom: 20 }}
                />
              ) : null}
              <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.2 }}>{ann.title}</div>
              <div style={{ fontSize: 15, color: MUTED, marginTop: 6 }}>{fmtDay(ann.createdAt)}</div>
              <div
                style={{ fontSize: 22, lineHeight: 1.55, marginTop: 16, maxHeight: 340, overflow: "hidden" }}
                dangerouslySetInnerHTML={{ __html: ann.content }}
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: MUTED }}>
              Δεν υπάρχουν ενεργές ανακοινώσεις.
            </div>
          )}
          {annCount > 1 ? (
            <div style={{ display: "flex", gap: 10, justifyContent: "center", paddingTop: 20 }}>
              {data.announcements.map((a, i) => (
                <span
                  key={a.id}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: i === idx % annCount ? AMBER : "rgba(246,244,236,.22)",
                  }}
                />
              ))}
            </div>
          ) : null}
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 32, minHeight: 0 }}>
          <section style={card}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: AMBER }}>
              Επερχόμενες συντηρήσεις
            </div>
            {data.tasks.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
                {data.tasks.map((t) => (
                  <div key={t.id}>
                    <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.25 }}>{t.title}</div>
                    <div style={{ fontSize: 17, color: MUTED }}>
                      {t.nextDueDate ? fmtDay(t.nextDueDate) : ""}
                      {t.vendor ? ` · ${t.vendor}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 19, color: MUTED, marginTop: 14 }}>Καμία προγραμματισμένη εργασία.</div>
            )}
          </section>

          {data.assembly ? (
            <section style={card}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: AMBER }}>
                Επόμενη συνέλευση
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 14, lineHeight: 1.25 }}>{data.assembly.title}</div>
              <div style={{ fontSize: 19, color: MUTED, marginTop: 6 }}>{fmtFull(data.assembly.scheduledAt)}</div>
            </section>
          ) : null}

          {data.collection.pct !== null ? (
            <section style={{ ...card, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: AMBER }}>
                Εισπράξεις μήνα
              </div>
              <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05, marginTop: 8, color: CREAM }}>
                {data.collection.pct}
                <span style={{ fontSize: 44, fontWeight: 700, color: MUTED }}>%</span>
              </div>
            </section>
          ) : null}
        </aside>
      </main>

      {/* ── Footer: contacts strip (marquee when >4) ─────────────────────── */}
      {data.contacts.length ? (
        <footer style={{ ...card, padding: "24px 32px", overflow: "hidden" }}>
          <div
            style={
              marquee
                ? { display: "flex", gap: 64, width: "max-content", animation: "marquee 30s linear infinite" }
                : { display: "flex", gap: 64, justifyContent: "center", flexWrap: "wrap" }
            }
          >
            {(marquee ? [...data.contacts, ...data.contacts] : data.contacts).map((c, i) => (
              <div key={`${c.id}-${i}`} style={{ display: "flex", alignItems: "baseline", gap: 12, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 20, fontWeight: 600 }}>{c.name}</span>
                {c.category ? <span style={{ fontSize: 17, color: MUTED }}>· {c.category}</span> : null}
                {c.phone ? <span style={{ fontSize: 26, fontWeight: 800, color: AMBER }}>{c.phone}</span> : null}
              </div>
            ))}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
