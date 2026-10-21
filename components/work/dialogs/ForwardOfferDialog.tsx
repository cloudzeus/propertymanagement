"use client";

import { useState } from "react";
import { RiStarFill } from "react-icons/ri";
import { FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { forwardOffer } from "@/app/actions/rfq";
import { applyMarkup, eur, withVat, type OfferDTO } from "@/lib/rfq-shared";
import { DialogFrame, useDialogRun, muted, checkRow, type DialogProps } from "./shared";

const fmtD = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR") : "—");

export function ForwardOfferDialog({ ctx, onDone, onClose }: DialogProps) {
  const offers: OfferDTO[] = ctx.rfqs.filter((r) => r.status === "OPEN" || r.status === "OFFERED").flatMap((r) => r.offers.filter((o) => o.status === "SUBMITTED"));
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const offer = offers.find((o) => o.id === offerId) ?? null;
  const [covered, setCovered] = useState(ctx.fault?.handledBy === "COMPANY");
  const [markup, setMarkup] = useState(String(ctx.defaults.markupPct));
  const [price, setPrice] = useState(offer ? String(applyMarkup(offer.amount, ctx.defaults.markupPct)) : "");
  const [message, setMessage] = useState("");
  const { busy, error, run } = useDialogRun(onDone);

  const pick = (o: OfferDTO) => { setOfferId(o.id); setPrice(String(applyMarkup(o.amount, Number(markup) || 0))); };
  const setMk = (v: string) => { setMarkup(v); const m = Number(v); if (offer && Number.isFinite(m)) setPrice(String(applyMarkup(offer.amount, m))); };
  const net = Number(price) || 0;

  return (
    <DialogFrame title="Προώθηση προσφοράς στον πελάτη" width={640} error={error} busy={busy} onClose={onClose}
      primary={{ label: covered ? "Ανάθεση χωρίς χρέωση" : "Αποστολή προσφοράς στον πελάτη", disabled: !offer,
        onClick: () => run(() => forwardOffer(offer!.id, { markupPct: Number(markup), customerPrice: net, message, covered, warrantyMonths: ctx.defaults.warrantyMonths }),
          (r) => `Σύμβαση έργου ${"number" in r ? (r as { number: string }).number : ""} — ${covered ? "ανατέθηκε" : "στάλθηκε στον πελάτη"}`) }}>
      {ctx.fault && <p style={muted}>{ctx.fault.title}</p>}
      {offers.length === 0 && <p style={muted}>Δεν υπάρχουν προσφορές προς προώθηση.</p>}
      {offers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {offers.map((o) => (
            <label key={o.id} style={{ ...checkRow, alignItems: "center", border: `1px solid ${o.id === offerId ? "var(--primary)" : "var(--border)"}`, borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
              {offers.length > 1 && <input type="radio" name="offer" checked={o.id === offerId} onChange={() => pick(o)} />}
              <b>{o.supplierName}</b>
              <span style={{ fontWeight: 700 }}>{eur(o.amount)} <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>+ ΦΠΑ {o.vatPct}%</span></span>
              {o.supplierRating != null && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#b45309", fontSize: "var(--fs-12)" }}><RiStarFill /> {o.supplierRating.toFixed(1)}</span>}
              <span style={muted}>από {fmtD(o.earliestDate)} · έως {fmtD(o.validUntil)}</span>
            </label>
          ))}
        </div>
      )}
      <label style={checkRow}><input type="checkbox" checked={covered} onChange={(e) => setCovered(e.target.checked)} style={{ marginTop: 3 }} /><span>Καλύπτεται από τη σύμβαση διαχείρισης — χωρίς χρέωση/αποδοχή πελάτη, άμεση ανάθεση</span></label>
      {!covered && offer && (
        <div style={{ display: "grid", gridTemplateColumns: "120px 160px 1fr", gap: 10, alignItems: "end" }}>
          <FormField label="Περιθώριο %"><FieldInput type="number" value={markup} onChange={setMk} /></FormField>
          <FormField label="Τιμή πελάτη (καθ.)"><FieldInput type="number" value={price} onChange={setPrice} /></FormField>
          <div style={{ ...muted, paddingBottom: 8 }}>Ο πελάτης θα δει <b style={{ color: "var(--foreground)" }}>{eur(net)} + ΦΠΑ = {eur(withVat(net, offer.vatPct))}</b> · κέρδος {eur(net - offer.amount)}</div>
        </div>
      )}
      <FormField label="Μήνυμα προς τον πελάτη (προαιρετικά)"><FieldTextarea value={message} onChange={setMessage} rows={2} placeholder="π.χ. Περιλαμβάνει υλικά και εργασία· εγγύηση 6 μήνες." /></FormField>
    </DialogFrame>
  );
}
