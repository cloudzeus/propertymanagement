"use client";

import { useState } from "react";
import { RiStarFill } from "react-icons/ri";
import { FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { forwardOffer } from "@/app/actions/rfq";
import { applyMarkup, eur, withVat, type OfferDTO } from "@/lib/rfq-shared";
import { formatDistance } from "@/lib/distance/zones";
import { DialogFrame, useDialogRun, muted, checkRow, type DialogProps } from "./shared";

const fmtD = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR") : "—");
const round2 = (n: number) => Math.round(n * 100) / 100;

export function ForwardOfferDialog({ ctx, onDone, onClose }: DialogProps) {
  const offers: OfferDTO[] = ctx.rfqs.filter((r) => r.status === "OPEN" || r.status === "OFFERED").flatMap((r) => r.offers.filter((o) => o.status === "SUBMITTED"));
  const bd = ctx.defaults.building;
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const offer = offers.find((o) => o.id === offerId) ?? null;
  const [covered, setCovered] = useState(ctx.fault?.handledBy === "COMPANY");
  const [markup, setMarkup] = useState(String(ctx.defaults.markupPct));
  const [travel, setTravel] = useState(String(bd.travelFee));
  const [price, setPrice] = useState(offer ? String(round2(applyMarkup(offer.amount, ctx.defaults.markupPct) + bd.travelFee)) : "");
  const [message, setMessage] = useState("");
  const { busy, error, run } = useDialogRun(onDone);

  const recalc = (o: OfferDTO | null, mk: string, tr: string) => {
    const m = Number(mk), t = Number(tr);
    if (o && Number.isFinite(m)) setPrice(String(round2(applyMarkup(o.amount, m) + (Number.isFinite(t) ? Math.max(0, t) : 0))));
  };
  const pick = (o: OfferDTO) => { setOfferId(o.id); recalc(o, markup, travel); };
  const setMk = (v: string) => { setMarkup(v); recalc(offer, v, travel); };
  const setTr = (v: string) => { setTravel(v); recalc(offer, markup, v); };
  const net = Number(price) || 0;

  return (
    <DialogFrame title="Προώθηση προσφοράς στον πελάτη" width={680} error={error} busy={busy} onClose={onClose}
      primary={{ label: covered ? "Ανάθεση χωρίς χρέωση" : "Αποστολή προσφοράς στον πελάτη", disabled: !offer,
        onClick: () => run(() => forwardOffer(offer!.id, { markupPct: Number(markup), customerPrice: net, message, covered, warrantyMonths: ctx.defaults.warrantyMonths, travelFee: Number(travel) || 0 }),
          (r) => `Σύμβαση έργου ${"number" in r ? (r as { number: string }).number : ""} — ${covered ? "ανατέθηκε" : "στάλθηκε στον πελάτη"}`) }}>
      {ctx.fault && <p style={muted}>{ctx.fault.title}</p>}
      {offers.length === 0 && <p style={muted}>Δεν υπάρχουν προσφορές προς προώθηση.</p>}
      {offers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {offers.map((o) => (
            <label key={o.id} style={{ ...checkRow, alignItems: "center", flexWrap: "wrap", border: `1px solid ${o.id === offerId ? "var(--primary)" : "var(--border)"}`, borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
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
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, alignItems: "end" }}>
            <FormField label="Περιθώριο %"><FieldInput type="number" value={markup} onChange={setMk} /></FormField>
            <FormField label={`Μετάβαση (καθ.)${bd.zoneLabel ? ` · ${bd.zoneLabel}` : ""}`}><FieldInput type="number" value={travel} onChange={setTr} /></FormField>
            <FormField label="Τιμή πελάτη (καθ.)"><FieldInput type="number" value={price} onChange={setPrice} /></FormField>
          </div>
          <div style={muted}>
            Ο πελάτης θα δει <b style={{ color: "var(--foreground)" }}>{eur(net)} + ΦΠΑ = {eur(withVat(net, offer.vatPct))}</b> · κέρδος {eur(net - offer.amount - (Number(travel) || 0))}
            <span style={{ display: "block" }}>Κτήριο: {formatDistance(bd.distanceKm, bd.distanceMinutes, bd.distanceMethod)}{bd.distanceKm == null ? " — χωρίς απόσταση, χωρίς χρέωση μετάβασης" : ` · ${bd.zoneLabel}`}</span>
          </div>
        </>
      )}
      <FormField label="Μήνυμα προς τον πελάτη (προαιρετικά)"><FieldTextarea value={message} onChange={setMessage} rows={2} placeholder="π.χ. Περιλαμβάνει υλικά και εργασία· εγγύηση 6 μήνες." /></FormField>
    </DialogFrame>
  );
}
