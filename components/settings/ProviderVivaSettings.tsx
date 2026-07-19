"use client";

import { useState, useTransition } from "react";
import {
  RiBankCardLine,
  RiSaveLine,
  RiCheckLine,
  RiEyeLine,
  RiEyeOffLine,
  RiPencilLine,
  RiDatabase2Line,
  RiServerLine,
  RiErrorWarningLine,
} from "react-icons/ri";
import { saveProviderViva, type ProviderVivaEditView } from "@/app/actions/provider-viva";

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted-foreground)",
  display: "block",
  marginBottom: 6,
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13,
  color: "var(--foreground)",
  background: "var(--bg-canvas)",
  outline: "none",
  boxSizing: "border-box",
};

function SecretField({
  label,
  name,
  hasExisting,
  mask,
  value,
  editing,
  reveal,
  onEdit,
  onChange,
  onToggleReveal,
}: {
  label: string;
  name: string;
  hasExisting: boolean;
  mask: string | null;
  value: string;
  editing: boolean;
  reveal: boolean;
  onEdit: () => void;
  onChange: (v: string) => void;
  onToggleReveal: () => void;
}) {
  if (hasExisting && !editing) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "monospace",
              color: "var(--muted-foreground)",
              background: "var(--card)",
            }}
          >
            {mask ?? "••••"}
          </span>
          <button
            type="button"
            onClick={onEdit}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--card)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            <RiPencilLine size={14} /> Αλλαγή
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          name={name}
          type={reveal ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          placeholder={hasExisting ? "Κενό = διαγραφή" : "—"}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
        />
        <button
          type="button"
          onClick={onToggleReveal}
          title={reveal ? "Απόκρυψη" : "Εμφάνιση"}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--card)",
            cursor: "pointer",
            color: "var(--muted-foreground)",
          }}
        >
          {reveal ? <RiEyeOffLine size={15} /> : <RiEyeLine size={15} />}
        </button>
      </div>
    </div>
  );
}

export function ProviderVivaSettings({ initial }: { initial: ProviderVivaEditView }) {
  const [enabled, setEnabled] = useState(initial.providerVivaEnabled);
  const [clientId, setClientId] = useState(initial.providerVivaClientId);
  const [merchantId, setMerchantId] = useState(initial.providerVivaMerchantId);
  const [sourceCode, setSourceCode] = useState(initial.providerVivaSourceCode);

  const [clientSecretEditing, setClientSecretEditing] = useState(!initial.hasClientSecret);
  const [clientSecret, setClientSecret] = useState("");
  const [clientSecretReveal, setClientSecretReveal] = useState(false);

  const [apiKeyEditing, setApiKeyEditing] = useState(!initial.hasApiKey);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyReveal, setApiKeyReveal] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState(initial.source);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveProviderViva({
        providerVivaEnabled: enabled,
        providerVivaClientId: clientId,
        providerVivaMerchantId: merchantId,
        providerVivaSourceCode: sourceCode,
        clientSecret: clientSecretEditing ? clientSecret : undefined,
        apiKey: apiKeyEditing ? apiKey : undefined,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSaved(true);
      setSource(enabled && clientId && (clientSecretEditing ? clientSecret : initial.hasClientSecret) ? "db" : source);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  const sourceLabel = source === "db" ? "Βάση δεδομένων (DB)" : source === "env" ? "Μεταβλητές περιβάλλοντος (ENV)" : "Μη ρυθμισμένο";
  const SourceIcon = source === "db" ? RiDatabase2Line : source === "env" ? RiServerLine : RiErrorWarningLine;
  const sourceColor = source === "db" ? "var(--color-success)" : source === "env" ? "var(--color-warning)" : "var(--color-danger)";

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 760 }}>
      {/* Status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--card)",
        }}
      >
        <SourceIcon size={18} style={{ color: sourceColor }} />
        <div style={{ fontSize: 13, color: "var(--foreground)" }}>
          Ενεργή πηγή ρύθμισης: <strong style={{ color: sourceColor }}>{sourceLabel}</strong>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>
          DB-first · fallback σε ENV
        </span>
      </div>

      {/* Config card */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Λογαριασμός Viva (Provider)</h2>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
              Ο λογαριασμός Viva της πλατφόρμας για είσπραξη πληρωμών από χρήστες (π.χ. top-up πορτοφολιού).
            </p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>Ενεργό</span>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--color-primary)", cursor: "pointer" }} />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Client ID</label>
            <input value={clientId} onChange={(e) => setClientId(e.target.value)} style={inputStyle} autoComplete="off" />
          </div>
          <SecretField
            label="Client Secret"
            name="clientSecret"
            hasExisting={initial.hasClientSecret}
            mask={initial.clientSecretMask}
            value={clientSecret}
            editing={clientSecretEditing}
            reveal={clientSecretReveal}
            onEdit={() => setClientSecretEditing(true)}
            onChange={setClientSecret}
            onToggleReveal={() => setClientSecretReveal((r) => !r)}
          />
          <div>
            <label style={labelStyle}>Merchant ID</label>
            <input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} style={inputStyle} autoComplete="off" />
          </div>
          <SecretField
            label="API Key"
            name="apiKey"
            hasExisting={initial.hasApiKey}
            mask={initial.apiKeyMask}
            value={apiKey}
            editing={apiKeyEditing}
            reveal={apiKeyReveal}
            onEdit={() => setApiKeyEditing(true)}
            onChange={setApiKey}
            onToggleReveal={() => setApiKeyReveal((r) => !r)}
          />
          <div>
            <label style={labelStyle}>Source Code</label>
            <input value={sourceCode} onChange={(e) => setSourceCode(e.target.value)} style={inputStyle} autoComplete="off" />
          </div>
        </div>

        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <RiBankCardLine size={13} /> Τα μυστικά αποθηκεύονται κρυπτογραφημένα (AES-256-GCM) και δεν εμφανίζονται ποτέ ολόκληρα. Αφήστε ένα πεδίο μυστικού κενό σε λειτουργία «Αλλαγή» για διαγραφή.
        </p>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 6 }}>
          <RiErrorWarningLine size={15} /> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            borderRadius: "var(--radius)",
            background: saved ? "var(--color-success)" : "var(--color-primary)",
            color: "#fff",
            border: "none",
            cursor: isPending ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 600,
            opacity: isPending ? 0.7 : 1,
            transition: "background 0.3s",
          }}
        >
          {saved ? <RiCheckLine size={15} /> : <RiSaveLine size={15} />}
          {isPending ? "Αποθήκευση..." : saved ? "Αποθηκεύτηκε!" : "Αποθήκευση"}
        </button>
      </div>
    </form>
  );
}
