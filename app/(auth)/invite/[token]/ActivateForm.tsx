"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { activateInvite } from "@/app/actions/invite";
import { FormField, FieldInput } from "@/components/ui/modal";
import { RiCheckLine, RiLoaderLine } from "react-icons/ri";

export function ActivateForm({ token, initialName }: { token: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await activateInvite(token, { name, password, confirm, agreed });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && <div role="alert" style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: "var(--fs-12-5)", border: "1px solid #fca5a530" }}>{error}</div>}
      <FormField label="Ονοματεπώνυμο" required><FieldInput value={name} onChange={setName} required /></FormField>
      <FormField label="Κωδικός" required hint="τουλάχιστον 8 χαρακτήρες"><FieldInput type="password" value={password} onChange={setPassword} required /></FormField>
      <FormField label="Επιβεβαίωση κωδικού" required><FieldInput type="password" value={confirm} onChange={setConfirm} required /></FormField>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "var(--fs-12-5)", color: "var(--foreground)", cursor: "pointer" }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Αποδέχομαι τους <Link href="/terms" target="_blank" style={{ color: "var(--color-primary)" }}>όρους χρήσης</Link> και την <Link href="/privacy" target="_blank" style={{ color: "var(--color-primary)" }}>πολιτική απορρήτου</Link>.</span>
      </label>
      <button type="submit" disabled={pending} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 42, border: "none", borderRadius: 999, background: "var(--primary)", color: "var(--primary-foreground)", fontSize: "var(--fs-14)", fontWeight: 700, cursor: "pointer" }}>
        {pending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Ενεργοποίηση & είσοδος
      </button>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </form>
  );
}
