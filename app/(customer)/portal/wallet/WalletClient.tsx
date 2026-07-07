"use client";
import { useEffect, useState } from "react";
import { RiWallet3Line } from "react-icons/ri";

interface Txn {
  id: string;
  type: string;
  amountEur: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export default function WalletClient() {
  const [balance, setBalance] = useState(0);
  const [allowance, setAllowance] = useState(0);
  const [ledger, setLedger] = useState<Txn[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const r = await fetch("/api/wallet/me");
    if (r.ok) {
      const d = await r.json();
      setBalance(d.balanceEur);
      setAllowance(d.monthlyAllowanceEur);
      setLedger(d.ledger ?? []);
    }
    setLoaded(true);
  };
  useEffect(() => {
    load();
  }, []);

  const topup = async () => {
    setBuying(true);
    setMsg(null);
    const r = await fetch("/api/wallet/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountEur: 10 }),
    });
    setBuying(false);
    if (r.ok) {
      const { checkoutUrl } = await r.json();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
    }
    setMsg("Οι πληρωμές δεν είναι διαθέσιμες αυτή τη στιγμή.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--foreground)",
        }}
      >
        <RiWallet3Line /> Το πορτοφόλι μου
      </h1>

      {loaded && balance <= 0 && (
        <div
          style={{
            padding: 16,
            borderRadius: "var(--radius)",
            background: "#FEE7E618",
            border: "1px solid var(--color-danger)",
            color: "var(--color-danger)",
            fontSize: 13,
          }}
        >
          Οι μονάδες AI εξαντλήθηκαν — αγοράστε για να συνεχίσετε.
        </div>
      )}

      {msg && (
        <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>{msg}</div>
      )}

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "20px 24px",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Υπόλοιπο</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)" }}>
          €{balance.toFixed(2)}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
          Μηνιαίο allowance: €{allowance.toFixed(2)}
        </div>
        <button
          onClick={topup}
          disabled={buying}
          style={{
            marginTop: 16,
            padding: "8px 16px",
            borderRadius: "var(--radius)",
            background: "var(--color-primary, #2563eb)",
            color: "#fff",
            border: "none",
            cursor: buying ? "default" : "pointer",
          }}
        >
          {buying ? "…" : "Αγορά extra μονάδων +€10"}
        </button>
      </div>

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: 12 }}>Ημ/νία</th>
              <th>Τύπος</th>
              <th>Ποσό</th>
              <th>Υπόλοιπο</th>
              <th>Περιγραφή</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: 12 }}>{new Date(t.createdAt).toLocaleString()}</td>
                <td>{t.type}</td>
                <td
                  style={{
                    color: t.amountEur < 0 ? "var(--color-danger)" : "var(--color-success)",
                  }}
                >
                  €{t.amountEur.toFixed(4)}
                </td>
                <td>€{t.balanceAfter.toFixed(4)}</td>
                <td>{t.description}</td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: "var(--muted-foreground)" }}>
                  Καμία κίνηση.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
