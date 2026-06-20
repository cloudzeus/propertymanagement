"use client";

import { useEffect, useRef, useState } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import {
  DailyProvider,
  DailyVideo,
  useDaily,
  useParticipantIds,
  useParticipant,
  useLocalSessionId,
  useTranscription,
} from "@daily-co/daily-react";
import { RiMicLine, RiRecordCircleLine, RiLogoutBoxLine, RiLoaderLine } from "react-icons/ri";
import { getAssemblyToken, endAssembly } from "@/app/actions/assemblies";

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 20,
};

export function AssemblyRoom({ assemblyId, isStaff }: { assemblyId: string; isStaff: boolean }) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN;
    if (!domain) {
      setError("Λείπει η ρύθμιση NEXT_PUBLIC_DAILY_DOMAIN.");
      setJoining(false);
      return;
    }

    let co: DailyCall | null = null;
    (async () => {
      try {
        const { token, roomName } = await getAssemblyToken(assemblyId);
        if (!token || !roomName) {
          setError("Δεν ήταν δυνατή η σύνδεση στη συνέλευση.");
          setJoining(false);
          return;
        }
        const url = `https://${domain}.daily.co/${roomName}`;
        // Reuse/cleanup any existing instance (React StrictMode double-mount in dev
        // otherwise throws "Duplicate DailyIframe instances are not allowed").
        const existing = DailyIframe.getCallInstance();
        if (existing) {
          try { await existing.leave(); } catch { /* noop */ }
          try { await existing.destroy(); } catch { /* noop */ }
        }
        co = DailyIframe.createCallObject({ audioSource: true, videoSource: true });
        await co.join({ url, token, startVideoOff: false, startAudioOff: false });
        setCallObject(co);
      } catch (e) {
        console.error("[AssemblyRoom] join failed:", e);
        const msg =
          e instanceof Error ? e.message
          : (e as any)?.errorMsg ?? (e as any)?.error ?? (typeof e === "string" ? e : JSON.stringify(e));
        setError(`Σφάλμα σύνδεσης: ${msg}`);
      } finally {
        setJoining(false);
      }
    })();

    return () => {
      try {
        co?.leave();
        co?.destroy();
      } catch {
        /* noop */
      }
    };
  }, [assemblyId]);

  if (error) {
    return (
      <div style={{ ...cardStyle, color: "var(--muted-foreground)", fontSize: 13 }}>{error}</div>
    );
  }

  if (joining || !callObject) {
    return (
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 10, color: "var(--muted-foreground)", fontSize: 13 }}>
        <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> Σύνδεση στη συνέλευση…
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <RoomInner assemblyId={assemblyId} isStaff={isStaff} />
    </DailyProvider>
  );
}

function RoomInner({ assemblyId, isStaff }: { assemblyId: string; isStaff: boolean }) {
  const daily = useDaily();
  const participantIds = useParticipantIds();
  const localId = useLocalSessionId();
  const { startTranscription, stopTranscription, isTranscribing, transcriptions } = useTranscription();
  const [ending, setEnding] = useState(false);

  function handleStart() {
    try {
      startTranscription({ language: "el", model: "nova-3", punctuate: true } as Parameters<typeof startTranscription>[0]);
    } catch {
      /* noop */
    }
  }

  async function handleEnd() {
    setEnding(true);
    const transcriptText = transcriptions
      .map((t) => `${t.user_name ?? "?"}: ${t.text}`)
      .join("\n");
    try {
      await endAssembly(assemblyId, transcriptText);
    } catch (e) {
      console.error("endAssembly failed", e);
    }
    try {
      stopTranscription?.();
    } catch {
      /* noop */
    }
    try {
      await daily?.leave();
    } catch {
      /* noop */
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <RiMicLine /> Συμμετέχοντες ({participantIds.length})
          </h2>
          {isStaff && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleStart}
                disabled={isTranscribing}
                style={btnStyle(isTranscribing)}
              >
                <RiRecordCircleLine /> {isTranscribing ? "Καταγραφή σε εξέλιξη" : "Έναρξη καταγραφής"}
              </button>
              <button type="button" onClick={handleEnd} disabled={ending} style={btnStyle(ending, true)}>
                <RiLogoutBoxLine /> Λήξη συνέλευσης
              </button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {participantIds.map((id) => (
            <ParticipantTile key={id} sessionId={id} isLocal={id === localId} />
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px" }}>
          Ζωντανή απομαγνητοφώνηση {isTranscribing ? "(σε εξέλιξη)" : ""}
        </h2>
        <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {transcriptions.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              {isStaff ? "Πατήστε «Έναρξη καταγραφής» για να ξεκινήσει η απομαγνητοφώνηση." : "Δεν υπάρχει ακόμη κείμενο."}
            </div>
          ) : (
            transcriptions.map((t, i) => (
              <div key={`${t.session_id}-${t.timestamp}-${i}`} style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--muted-foreground)" }}>{t.user_name ?? "Ομιλητής"}:</strong> {t.text}
              </div>
            ))
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ParticipantTile({ sessionId, isLocal }: { sessionId: string; isLocal: boolean }) {
  const p = useParticipant(sessionId);
  const name = p?.user_name || (isLocal ? "Εσείς" : "Συμμετέχων");
  const hasVideo = !!p?.video;
  return (
    <div
      style={{
        position: "relative",
        width: 220,
        height: 140,
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--bg-canvas)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {hasVideo ? (
        <DailyVideo
          sessionId={sessionId}
          type="video"
          automirror={isLocal}
          fit="cover"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Κάμερα κλειστή</span>
      )}
      <div
        style={{
          position: "absolute",
          left: 8,
          bottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 8px",
          borderRadius: 6,
          background: "rgba(0,0,0,0.55)",
          fontSize: 12,
          color: "#fff",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 9999,
            background: p?.audio ? "#22c55e" : "rgba(255,255,255,0.4)",
          }}
        />
        {name}
        {isLocal && <span style={{ fontSize: 11, opacity: 0.8 }}>(εσείς)</span>}
      </div>
    </div>
  );
}

function btnStyle(disabled: boolean, danger = false): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    padding: "7px 12px",
    borderRadius: 8,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
    border: `1px solid ${danger ? "#dc2626" : "var(--border)"}`,
    background: danger ? "#dc2626" : "var(--card)",
    color: danger ? "#fff" : "var(--foreground)",
  };
}
