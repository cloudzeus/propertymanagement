"use client";

import { useState, useTransition } from "react";
import { updateCompanyProfile, type CompanyProfileInput } from "@/app/actions/company-profile";
import { PropertyMapPicker } from "@/components/maps/PropertyMapPicker";
import { AddressAutocomplete, type ResolvedAddress } from "@/components/maps/AddressAutocomplete";
import {
  RiSaveLine, RiLoaderLine, RiMapPin2Line,
  RiBuildingLine, RiPhoneLine, RiFileTextLine,
  RiSearchLine,
} from "react-icons/ri";

type GeoResult = { lat: number; lng: number; displayName: string; confidence?: number };

// ─── Field Components ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingTop: 8 }}>
      <Icon style={{ fontSize: 15, color: "var(--color-primary)" }} />
      <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {title}
      </h3>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function FInput({
  label, value, onChange, placeholder, type = "text", hint, s1, action,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string; s1?: string;
  action?: { icon: React.ElementType; onClick: () => void; loading?: boolean; title?: string };
}) {
  const ActionIcon = action?.icon;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{label}</label>
        {s1 && <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{s1}</span>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            height: 34, padding: "0 10px", borderRadius: 6,
            border: "1px solid var(--border)", fontSize: 13,
            color: "var(--foreground)", background: "var(--card)",
            outline: "none", boxSizing: "border-box", width: "100%",
          }}
        />
        {action && ActionIcon && (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.loading}
            title={action.title}
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 6,
              border: "1px solid var(--color-primary)", background: "var(--color-primary)",
              color: "#fff", cursor: action.loading ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ActionIcon style={{ fontSize: 15, ...(action.loading ? { animation: "spin 1s linear infinite" } : {}) }} />
          </button>
        )}
      </div>
      {hint && <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>{hint}</p>}
    </div>
  );
}

function FSelect({
  label, value, onChange, options, placeholder, s1,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[] | { value: string; label: string }[];
  placeholder?: string; s1?: string;
}) {
  const normalized = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{label}</label>
        {s1 && <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{s1}</span>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 34, padding: "0 10px", borderRadius: 6,
          border: "1px solid var(--border)", fontSize: 13,
          color: "var(--foreground)", background: "var(--card)",
          outline: "none", boxSizing: "border-box", width: "100%",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {normalized.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Company type ──────────────────────────────────────────────────────────────

type Company = {
  id: string;
  name: string;
  legalName: string | null;
  legalForm: string | null;
  afm: string | null;
  taxOffice: string | null;
  activity: string | null;
  title: string | null;
  glnCode: string | null;
  registryNumber: string | null;
  vatStatus: string | null;
  distStats: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  phone1: string | null;
  phone2: string | null;
  phone3: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  gemhNumber: string | null;
  ikaNumber: string | null;
  ikaRegistry: string | null;
  folderNumber: string | null;
  kadCode: string | null;
  foundedAt: Date | null;
  dissolutionDate: Date | null;
  iban: string | null;
  bank: string | null;
  initialCapital: number | null;
  paidCapital: number | null;
  legalRep: string | null;
  legalRepId: string | null;
  tpte: string | null;
  tpteteka: string | null;
  employmentOrg: string | null;
  remarks: string | null;
  softoneCompanyCode: number | null;
};

const LEGAL_FORMS = ["ΑΕ", "ΕΠΕ", "ΙΚΕ", "ΟΕ", "ΕΕ", "ΑΤΟΜΙΚΗ", "ΚΟΙΝΟΠΡΑΞΙΑ", "ΑΛΛΟ"];
const VAT_STATUSES = ["Κανονικό", "Απαλλαγμένο", "Μικτό", "Αγρότης ειδ.καθεστ.", "Εκτός ΦΠΑ"];

// ─── Component ─────────────────────────────────────────────────────────────────

export function InfoTab({ company }: { company: Company }) {
  function str(v: string | null) { return v ?? ""; }
  function dateStr(v: Date | null) { return v ? new Date(v).toISOString().slice(0, 10) : ""; }

  const [form, setForm] = useState<Record<string, string>>({
    name:               str(company.name),
    legalName:          str(company.legalName),
    legalForm:          str(company.legalForm),
    afm:                str(company.afm),
    taxOffice:          str(company.taxOffice),
    activity:           str(company.activity),
    title:              str(company.title),
    glnCode:            str(company.glnCode),
    registryNumber:     str(company.registryNumber),
    vatStatus:          str(company.vatStatus),
    distStats:          str(company.distStats),
    address:            str(company.address),
    district:           str(company.district),
    city:               str(company.city),
    postalCode:         str(company.postalCode),
    country:            str(company.country) || "Ελλάδα",
    phone1:             str(company.phone1),
    phone2:             str(company.phone2),
    phone3:             str(company.phone3),
    fax:                str(company.fax),
    email:              str(company.email),
    website:            str(company.website),
    gemhNumber:         str(company.gemhNumber),
    ikaNumber:          str(company.ikaNumber),
    ikaRegistry:        str(company.ikaRegistry),
    folderNumber:       str(company.folderNumber),
    kadCode:            str(company.kadCode),
    foundedAt:          dateStr(company.foundedAt),
    dissolutionDate:    dateStr(company.dissolutionDate),
    iban:               str(company.iban),
    bank:               str(company.bank),
    initialCapital:     company.initialCapital != null ? String(company.initialCapital) : "",
    paidCapital:        company.paidCapital    != null ? String(company.paidCapital)    : "",
    legalRep:           str(company.legalRep),
    legalRepId:         str(company.legalRepId),
    tpte:               str(company.tpte),
    tpteteka:           str(company.tpteteka),
    employmentOrg:      str(company.employmentOrg),
    remarks:            str(company.remarks),
    softoneCompanyCode: company.softoneCompanyCode != null ? String(company.softoneCompanyCode) : "",
  });

  const [lat, setLat] = useState<number | null>(company.lat);
  const [lng, setLng] = useState<number | null>(company.lng);
  const [isPending, startTransition] = useTransition();
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoFocus, setGeoFocus] = useState<{ lat: number; lng: number; n: number } | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [afmLoading, setAfmLoading] = useState(false);

  async function handleAfmLookup() {
    const afm = form.afm.replace(/\D/g, "");
    if (afm.length !== 9) {
      setMsg({ type: "err", text: "Συμπληρώστε έγκυρο ΑΦΜ (9 ψηφία)" });
      return;
    }
    setAfmLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/aade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ afm }),
      });
      const data: { data?: Record<string, string>; error?: string } = await res.json();
      if (!res.ok || !data.data) {
        setMsg({ type: "err", text: data.error ?? "Δεν βρέθηκαν στοιχεία ΑΑΔΕ" });
        return;
      }
      // Fill only fields the ΑΑΔΕ returned, without wiping existing values.
      const d = data.data;
      setForm((p) => {
        const next = { ...p };
        for (const [k, v] of Object.entries(d)) {
          if (v) next[k] = v;
        }
        return next;
      });
      setMsg({ type: "ok", text: "Συμπληρώθηκαν τα στοιχεία από την ΑΑΔΕ" });

      // If an address came back, geocode it and move the map + pin.
      const query = [d.address, d.city, d.postalCode, d.country || "Ελλάδα"]
        .map((s) => (s ?? "").trim()).filter(Boolean).join(", ");
      if (d.address) {
        try {
          const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(query)}`);
          const geo: { results?: GeoResult[] } = await geoRes.json();
          const results = geo.results ?? [];
          if (results.length >= 1) {
            // Always move the map + pin to the best match immediately…
            focusMap(results[0].lat, results[0].lng);
            // …and keep the candidate list visible so the user can refine.
            setGeoResults(results.length > 1 ? results : []);
            setMsg({ type: "ok", text: `Στίγμα: ${results[0].displayName}` });
          } else {
            setMsg({ type: "err", text: "Συμπληρώθηκαν τα στοιχεία, αλλά δεν βρέθηκε στίγμα για τη διεύθυνση" });
          }
        } catch {
          /* address filled but geocoding failed — non-fatal */
        }
      }
    } catch {
      setMsg({ type: "err", text: "Σφάλμα αναζήτησης ΑΑΔΕ" });
    } finally {
      setAfmLoading(false);
    }
  }

  function focusMap(newLat: number, newLng: number) {
    setLat(newLat);
    setLng(newLng);
    setGeoFocus((prev) => ({ lat: newLat, lng: newLng, n: (prev?.n ?? 0) + 1 }));
  }

  const f = (key: string) => (v: string) => setForm((p) => ({ ...p, [key]: v }));

  function handleSave() {
    startTransition(async () => {
      const payload: CompanyProfileInput = {
        ...form,
        lat, lng,
        initialCapital:     form.initialCapital     ? parseFloat(form.initialCapital)      : null,
        paidCapital:        form.paidCapital         ? parseFloat(form.paidCapital)         : null,
        softoneCompanyCode: form.softoneCompanyCode  ? parseInt(form.softoneCompanyCode)    : null,
        foundedAt:          form.foundedAt           || null,
        dissolutionDate:    form.dissolutionDate      || null,
      };
      const res = await updateCompanyProfile(company.id, payload);
      if ("error" in res) setMsg({ type: "err", text: res.error ?? "Σφάλμα" });
      else setMsg({ type: "ok", text: "Αποθηκεύτηκε επιτυχώς" });
    });
  }

  function pickGeoResult(r: GeoResult) {
    focusMap(r.lat, r.lng);
    setGeoResults([]);
    setMsg({ type: "ok", text: `Επιλέχθηκε: ${r.displayName}` });
  }

  function handleResolvedAddress(r: ResolvedAddress) {
    setForm((p) => ({
      ...p,
      address:    r.address    || p.address,
      district:   r.district   || p.district,
      city:       r.city       || p.city,
      postalCode: r.postalCode || p.postalCode,
      country:    r.country    || p.country,
    }));
    if (r.lat !== null && r.lng !== null) {
      focusMap(r.lat, r.lng);
    }
    setGeoResults([]);
    setMsg({ type: "ok", text: `Διεύθυνση: ${r.formattedAddress}` });
  }

  const hasGeo = lat !== null && lng !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Save bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, paddingTop: 8 }}>
        {msg && (
          <span style={{
            fontSize: 12, padding: "5px 12px", borderRadius: 6,
            background: msg.type === "ok" ? "#dcfce718" : "#fee2e218",
            color: msg.type === "ok" ? "#16a34a" : "#dc2626",
            border: `1px solid ${msg.type === "ok" ? "#86efac30" : "#fca5a530"}`,
          }}>{msg.text}</span>
        )}
        <button onClick={handleSave} disabled={isPending} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600,
          background: "var(--color-primary)", color: "#fff",
          border: "none", cursor: isPending ? "wait" : "pointer",
        }}>
          {isPending
            ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} />
            : <RiSaveLine />}
          Αποθήκευση
        </button>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>

      {/* ── 1. Ταυτότητα ── */}
      <section>
        <SectionHeader icon={RiBuildingLine} title="Ταυτότητα Εταιρείας" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 2" }}>
            <FInput label="Επωνυμία" value={form.name} onChange={f("name")} placeholder="Εταιρεία ΑΕ" s1="NAME" />
          </div>
          <FSelect label="Νομική μορφή" value={form.legalForm} onChange={f("legalForm")} options={LEGAL_FORMS} placeholder="— Επιλογή —" s1="CATEGORY" />

          <FInput label="Εναλλακτική επωνυμία" value={form.legalName} onChange={f("legalName")} s1="NAME2" />
          <FInput label="Τίτλος" value={form.title} onChange={f("title")} placeholder="Γεν. Διευθυντής" s1="SOTITLE" />
          <FInput
            label="ΑΦΜ"
            value={form.afm}
            onChange={f("afm")}
            placeholder="123456789"
            s1="AFM"
            hint="Αναζήτηση στοιχείων από ΑΑΔΕ"
            action={{ icon: afmLoading ? RiLoaderLine : RiSearchLine, onClick: handleAfmLookup, loading: afmLoading, title: "Άντληση στοιχείων από ΑΑΔΕ" }}
          />

          <FInput label="ΔΟΥ" value={form.taxOffice} onChange={f("taxOffice")} placeholder="ΔΟΥ Αθηνών Α΄" s1="IRSDATA" />
          <FSelect label="Καθεστώς ΦΠΑ" value={form.vatStatus} onChange={f("vatStatus")} options={VAT_STATUSES} placeholder="— Επιλογή —" s1="VATSTS" />
          <FInput label="Κωδικός GLN" value={form.glnCode} onChange={f("glnCode")} s1="GLNCODE" />
        </div>
        <div style={{ marginTop: 12 }}>
          <FInput label="Αντικείμενο δραστηριότητας" value={form.activity} onChange={f("activity")} placeholder="Διαχείριση ακινήτων…" s1="SOUNIT" />
        </div>
      </section>

      {/* ── 2. Διεύθυνση & Χάρτης ── */}
      <section>
        <SectionHeader icon={RiMapPin2Line} title="Διεύθυνση & Χάρτης" />
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <AddressAutocomplete
            label="Διεύθυνση"
            value={form.address}
            onChange={f("address")}
            onResolved={handleResolvedAddress}
            placeholder="Πληκτρολογήστε διεύθυνση…"
            s1="ADDRESS"
          />
          <FInput label="Περιοχή" value={form.district} onChange={f("district")} placeholder="Αττική" s1="DISTRICT" />
          <FInput label="Πόλη" value={form.city} onChange={f("city")} placeholder="Αθήνα" s1="CITY" />

          <FInput label="Τ.Κ." value={form.postalCode} onChange={f("postalCode")} placeholder="10000" s1="ZIP" />
          <FInput label="Χώρα" value={form.country} onChange={f("country")} placeholder="Ελλάδα" s1="COUNTRY" />
          <div />
        </div>

        {/* Map */}
        <div style={{ background: "var(--bg-canvas)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: hasGeo ? "#16a34a" : "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 5 }}>
              <RiMapPin2Line style={{ fontSize: 14 }} />
              {hasGeo ? `${lat?.toFixed(6)}, ${lng?.toFixed(6)}` : "Χωρίς γεωδεδομένα"}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Το στίγμα προκύπτει από το πεδίο «Διεύθυνση» — σύρετε την πινέζα για χειροκίνητη διόρθωση
            </span>
          </div>

          {/* Geocoding candidate list */}
          {geoResults.length > 0 && (
            <div style={{
              border: "1px solid var(--border)", borderRadius: 6, marginBottom: 12,
              background: "var(--card)", overflow: "hidden",
            }}>
              {geoResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickGeoResult(r)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 8,
                    width: "100%", padding: "10px 14px", border: "none",
                    background: "transparent", cursor: "pointer", textAlign: "left",
                    borderBottom: i < geoResults.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-canvas)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <RiMapPin2Line style={{ fontSize: 15, color: "var(--color-primary)", flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.4 }}>{r.displayName}</span>
                  {r.confidence !== undefined && (
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)", flexShrink: 0 }}>
                      {Math.round(r.confidence * 100)}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <PropertyMapPicker
            initialLat={lat}
            initialLng={lng}
            initialAddress={[form.address, form.city].filter(Boolean).join(", ")}
            onLocationChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }}
            focusLat={geoFocus?.lat}
            focusLng={geoFocus?.lng}
            focusNonce={geoFocus?.n}
            height={280}
            showSearch={false}
          />
        </div>
      </section>

      {/* ── 3. Επικοινωνία ── */}
      <section>
        <SectionHeader icon={RiPhoneLine} title="Επικοινωνία" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <FInput label="Τηλέφωνο 1" value={form.phone1} onChange={f("phone1")} placeholder="210 1234567" s1="PHONE1" />
          <FInput label="Τηλέφωνο 2" value={form.phone2} onChange={f("phone2")} s1="PHONE2" />
          <FInput label="Τηλέφωνο 3" value={form.phone3} onChange={f("phone3")} s1="PHONE3" />
          <FInput label="Fax" value={form.fax} onChange={f("fax")} s1="FAX" />
          <FInput label="Email" value={form.email} onChange={f("email")} type="email" placeholder="info@company.gr" s1="EMAIL" />
          <FInput label="Ιστοσελίδα" value={form.website} onChange={f("website")} placeholder="https://…" s1="WEBPAGE" />
        </div>
      </section>

      {/* ── 4. Καταχώρηση ── */}
      <section>
        <SectionHeader icon={RiFileTextLine} title="Καταχώρηση & Νομικά Στοιχεία" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <FInput label="Γ.Ε.ΜΗ" value={form.gemhNumber} onChange={f("gemhNumber")} s1="NUMCG" />
          <FInput label="Αριθ. μητρώου" value={form.registryNumber} onChange={f("registryNumber")} s1="NUMBERM" />
          <FInput label="Αρ. φακέλου" value={form.folderNumber} onChange={f("folderNumber")} s1="FOLDERNUM" />

          <FInput label="ΚΑΔ" value={form.kadCode} onChange={f("kadCode")} placeholder="68.20.11.01" s1="KADTAXIS" />
          <FInput label="Ημ. Ίδρυσης" value={form.foundedAt} onChange={f("foundedAt")} type="date" s1="CRTDATE" />
          <FInput label="Ημ. Λύσης" value={form.dissolutionDate} onChange={f("dissolutionDate")} type="date" s1="FNLDATE" />
        </div>
      </section>

    </div>
  );
}
