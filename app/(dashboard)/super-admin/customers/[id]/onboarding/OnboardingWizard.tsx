"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAiChat } from "@/hooks/useAiChat";
import { createBuildingFromOnboarding } from "@/app/actions/building-onboarding";
import { type HeatingType } from "@/lib/ai/agents/building-onboarding";

type Form = { address?: string; totalApartments?: number; heatingType?: HeatingType; managerName?: string };
const HEATING_LABEL: Record<HeatingType, string> = {
  CENTRAL: "Κεντρική",
  AUTONOMOUS_HOURS: "Αυτονομία (ωρομετρητές)",
  AUTONOMOUS_METERS: "Αυτονομία (θερμιδομετρητές)",
  GAS: "Φυσικό αέριο",
};

export function OnboardingWizard({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const { messages, input, setInput, send, isStreaming, error } = useAiChat({
    agentKey: "building-onboarding",
    onToolCall: (name, args) => {
      if (name !== "updateBuildingOnboardingData") return;
      const a = args as Form;
      setForm((f) => ({ ...f, ...a }));
      const changed = Object.keys(a)[0];
      if (changed) {
        setFlash(changed);
        setTimeout(() => setFlash(null), 1200);
      }
    },
  });

  const complete = !!(form.address && form.totalApartments && form.heatingType && form.managerName);
  const method = form.heatingType === "AUTONOMOUS_METERS" ? "70/30 μετρητής" : "χιλιοστά θέρμανσης";

  function create() {
    setErr(null);
    startTransition(async () => {
      const res = await createBuildingFromOnboarding(customerId, form);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      router.push(`/super-admin/buildings/${res.buildingId}`);
    });
  }

  const cell = (key: keyof Form, label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", background: flash === key ? "#fef3c7" : undefined }}>
      <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <b style={{ color: "var(--foreground)" }}>{value || "—"}</b>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 120px)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid var(--border)", borderRadius: 8 }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)", fontWeight: 600, color: "var(--foreground)" }}>
          AI Onboarding — {customerName}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 12, fontSize: 14, lineHeight: 1.6 }}>
          {messages.length === 0 && (
            <div style={{ color: "var(--muted-foreground)" }}>
              Πείτε μου για την πολυκατοικία: διεύθυνση, διαμερίσματα, θέρμανση, διαχειριστή.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 10, textAlign: m.role === "user" ? "right" : "left" }}>
              <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: 10, background: m.role === "user" ? "#eef2ff" : "#f4f4f6" }}>
                {m.content || (isStreaming ? "…" : "")}
              </span>
            </div>
          ))}
          {error && <div style={{ color: "#c00" }}>{error}</div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid var(--border)" }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Γράψτε μήνυμα…" disabled={isStreaming} style={{ flex: 1 }} />
          <button type="submit" disabled={isStreaming || !input.trim()}>➤</button>
        </form>
      </div>

      <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: "var(--foreground)" }}>
          Στοιχεία κτηρίου <span style={{ fontSize: 11, color: "#16a34a" }}>● live</span>
        </div>
        {cell("managerName", "Διαχειριστής", form.managerName ?? "")}
        {cell("address", "Διεύθυνση", form.address ?? "")}
        {cell("totalApartments", "Διαμερίσματα", form.totalApartments?.toString() ?? "")}
        {cell("heatingType", "Θέρμανση", form.heatingType ? HEATING_LABEL[form.heatingType] : "")}
        {form.heatingType && (
          <div style={{ fontSize: 11, color: "#f59e0b", textAlign: "right" }}>→ μέθοδος: {method}</div>
        )}
        {err && <div style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
        <button onClick={create} disabled={!complete || pending} style={{ marginTop: 18, width: "100%" }}>
          {pending ? "Δημιουργία…" : "Δημιουργία & συνέχεια στις λεπτομέρειες →"}
        </button>
      </div>
    </div>
  );
}
