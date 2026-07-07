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

export default function CompanyWalletClient() {
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<Txn[]>([]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/super-admin/wallet");
    if (res.ok) {
      const d = await res.json();
      setBalance(d.balanceEur);
      setLedger(d.ledger);
    } else {
      setError("Failed to load wallet");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const credit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a positive amount");
      return;
    }
    const res = await fetch("/api/super-admin/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountEur: amt }),
    });
    if (res.ok) {
      setAmount("");
      setError(null);
      await load();
    } else {
      setError("Credit failed");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
        <RiWallet3Line /> Company Wallet
      </h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Wholesale credit balance</p>
        <p className="text-3xl font-bold text-gray-900">€{balance.toFixed(2)}</p>
        <div className="mt-4 flex gap-2">
          <input
            className="border p-2 rounded"
            placeholder="€ amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button onClick={credit} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Credit
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Balance</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="p-3">{new Date(t.createdAt).toLocaleString()}</td>
                <td>{t.type}</td>
                <td className={t.amountEur < 0 ? "text-red-600" : "text-green-600"}>
                  €{t.amountEur.toFixed(4)}
                </td>
                <td>€{t.balanceAfter.toFixed(4)}</td>
                <td>{t.description}</td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-gray-500">
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
