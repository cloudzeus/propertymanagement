"use client";

import { useEffect, useState, useTransition } from "react";
import {
  RiBankCardLine, RiLockPasswordLine, RiCheckLine, RiErrorWarningLine,
  RiInformationLine, RiPencilLine, RiLoader4Line,
} from "react-icons/ri";
import {
  getPropertyVivaForEdit, savePropertyViva, type PropertyVivaView,
} from "@/app/actions/property-viva";

/**
 * Per-property Viva credential setup. Role-gated by the server action
 * (SUPER_ADMIN/ADMIN/MANAGER, or the assigned PROPERTY_ADMIN). The decrypted API
 * key is NEVER sent to the client — only a masked view («••••1234»). Leaving the
 * key field blank keeps the stored key (sends apiKey: undefined).
 */
export function PropertyVivaSetup({ propertyId }: { propertyId: string }) {
  const [view, setView] = useState<PropertyVivaView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [merchantId, setMerchantId] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [editKey, setEditKey] = useState(false);

  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function hydrate(v: PropertyVivaView) {
    setView(v);
    setEnabled(v.vivaEnabled);
    setMerchantId(v.vivaMerchantId ?? "");
    setSourceCode(v.vivaSourceCode ?? "");
    setApiKey("");
    setEditKey(!v.hasApiKey);
  }

  useEffect(() => {
    let alive = true;
    getPropertyVivaForEdit(propertyId)
      .then((v) => { if (alive) hydrate(v); })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : "Σφάλμα φόρτωσης"); });
    return () => { alive = false; };
  }, [propertyId]);

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      try {
        const saved = await savePropertyViva(propertyId, {
          vivaEnabled: enabled,
          vivaMerchantId: merchantId.trim() || null,
          vivaSourceCode: sourceCode.trim() || null,
          // Only send a new key when the user chose to edit it; blank keeps the stored one.
          apiKey: editKey ? (apiKey.trim() || null) : undefined,
        });
        hydrate(saved);
        setMsg({ kind: "ok", text: "Αποθηκεύτηκε." });
      } catch (e) {
        setMsg({ kind: "err", text: e instanceof Error ? e.message : "Σφάλμα αποθήκευσης" });
      }
    });
  }

  if (loadError) {
    return (
      <div style={card}>
        <div style={{ ...alert("err") }}>
          <RiErrorWarningLine style={{ fontSize: 16, flexShrink: 0 }} />
          {loadError === "Forbidden" ? "Δεν έχετε πρόσβαση στις ρυθμίσεις Viva αυτής της ιδιοκτησίας." : loadError}
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 8, color: "var(--muted-foreground)", fontSize: 13 }}>
        <RiLoader4Line style={{ fontSize: 16, animation: "pvspin 1s linear infinite" }} /> Φόρτωση…
        <style>{"@keyframes pvspin{to{transform:rotate(360deg)}}"}</style>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RiBankCardLine style={{ fontSize: 20 }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>Viva πληρωμές</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Στοιχεία Viva της ιδιοκτησίας — τα κοινόχρηστα εισπράττονται στον δικό της λογαριασμό.
          </div>
        </div>
      </div>

      {/* Enable switch */}
      <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
        <Toggle on={enabled} onChange={setEnabled} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Ενεργό</span>
      </label>

      <Field label="Merchant ID">
        <input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} placeholder="Viva Merchant ID"
          autoComplete="off" style={input} />
      </Field>

      <Field label="Source Code">
        <input value={sourceCode} onChange={(e) => setSourceCode(e.target.value)} placeholder="Πηγή πληρωμής (source code)"
          autoComplete="off" style={input} />
      </Field>

      <Field label="API Key">
        {view.hasApiKey && !editKey ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--foreground)", fontFamily: "monospace" }}>
              <RiLockPasswordLine style={{ color: "var(--muted-foreground)" }} /> {view.apiKeyMask}
            </span>
            <button type="button" onClick={() => { setEditKey(true); setApiKey(""); }} style={smallBtn}>
              <RiPencilLine /> Αλλαγή
            </button>
          </div>
        ) : (
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="Νέο API Key"
            autoComplete="new-password" style={input} />
        )}
      </Field>

      {/* Read-only status line */}
      <div style={{ ...alert("info"), marginTop: 14 }}>
        <RiInformationLine style={{ fontSize: 16, flexShrink: 0 }} />
        Οι online πληρωμές ενεργοποιούνται όταν οριστούν τα στοιχεία, επαληθευτεί το Viva (sandbox) και ανοίξει ο γενικός διακόπτης.
      </div>

      {msg && (
        <div style={{ ...alert(msg.kind === "ok" ? "ok" : "err"), marginTop: 12 }}>
          {msg.kind === "ok" ? <RiCheckLine style={{ fontSize: 16 }} /> : <RiErrorWarningLine style={{ fontSize: 16 }} />}
          {msg.text}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" onClick={onSave} disabled={pending} style={{ ...saveBtn, opacity: pending ? 0.6 : 1, cursor: pending ? "default" : "pointer" }}>
          {pending ? <RiLoader4Line style={{ animation: "pvspin 1s linear infinite" }} /> : <RiCheckLine />}
          Αποθήκευση
        </button>
      </div>
      <style>{"@keyframes pvspin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0,
      background: on ? "var(--color-primary)" : "var(--border)", position: "relative", transition: "background .15s",
    }}>
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px" };
const input: React.CSSProperties = { width: "100%", maxWidth: 360, height: 34, padding: "0 10px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-canvas)", color: "var(--foreground)" };
const smallBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 5, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", fontSize: 13, fontWeight: 600 };

function alert(kind: "ok" | "err" | "info"): React.CSSProperties {
  const map = {
    ok: { bg: "#16a34a14", fg: "#16a34a", bd: "#16a34a30" },
    err: { bg: "#dc262614", fg: "#dc2626", bd: "#dc262630" },
    info: { bg: "var(--bg-canvas)", fg: "var(--muted-foreground)", bd: "var(--border)" },
  }[kind];
  return { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 6, background: map.bg, color: map.fg, border: `1px solid ${map.bd}`, fontSize: 12.5, lineHeight: 1.4 };
}
