"use client";

/**
 * Loaders: fetch the small amount of context a wizard needs when it is opened
 * from a deep link (WizardHost) rather than from a page that already has the
 * data. Each renders a tiny loading modal, then the wizard.
 */
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { listCustomerOptions, listManagerOptions, peekNextCustomerCode } from "@/app/actions/customers";
import { CustomerWizard } from "./CustomerWizard";
import { PropertyWizard } from "./PropertyWizard";
import { BuildingWizard } from "./BuildingWizard";
import { getPropertyForBuildingWizard, listPropertyOptions, type PropertyForWizard } from "@/app/actions/properties";
import { ServiceWizard } from "./ServiceWizard";
import { listServiceWizardContext } from "@/app/actions/services";
import { PackageWizard, type PackageView } from "./PackageWizard";
import { listPropertyPackage } from "@/app/actions/property-package";
import { SupplierWizard } from "./SupplierWizard";
import { listSupplierWizardContext } from "@/app/actions/suppliers";
import { FieldSelect, FormField } from "@/components/ui/modal";
import type { WizardHostApi } from "./WizardHost";

export function LoadingModal({ title, error, onClose }: { title: string; error?: string | null; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={title} width={520}>
      <div style={{ padding: "12px 0", fontSize: "var(--fs-13-5)", color: error ? "var(--color-danger)" : "var(--muted-foreground)" }} role={error ? "alert" : "status"}>
        {error ?? "Φόρτωση…"}
      </div>
    </Modal>
  );
}

export function CustomerWizardLoader({ api }: { api: WizardHostApi }) {
  const [data, setData] = useState<{ managers: { id: string; name: string }[]; nextCode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([listManagerOptions(), peekNextCustomerCode()])
      .then(([managers, nextCode]) => { if (!cancelled) setData({ managers, nextCode }); })
      .catch(() => { if (!cancelled) setError("Δεν ήταν δυνατή η φόρτωση. Δοκιμάστε από τη σελίδα «Πελάτες»."); });
    return () => { cancelled = true; };
  }, []);
  if (!data) return <LoadingModal title="Νέος πελάτης βήμα-βήμα" error={error} onClose={api.onClose} />;
  return <CustomerWizard managers={data.managers} nextCode={data.nextCode} onClose={api.onClose} onDone={(c) => api.onDone(`Ο πελάτης «${c.name}» δημιουργήθηκε.`)} />;
}

export function PropertyWizardLoader({ api }: { api: WizardHostApi }) {
  const [customers, setCustomers] = useState<{ id: string; name: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    listCustomerOptions()
      .then((rows) => { if (!cancelled) setCustomers(rows); })
      .catch(() => { if (!cancelled) setError("Δεν ήταν δυνατή η φόρτωση των πελατών."); });
    return () => { cancelled = true; };
  }, []);
  if (!customers) return <LoadingModal title="Νέα ιδιοκτησία βήμα-βήμα" error={error} onClose={api.onClose} />;
  const customer = api.ctx.customerId ? customers.find((c) => c.id === api.ctx.customerId) ?? null : null;
  return <PropertyWizard customer={customer} customers={customers} onClose={api.onClose} onDone={(p) => api.onDone(`Η ιδιοκτησία «${p.name}» δημιουργήθηκε.`)} />;
}

/** Building wizard for a known property (from the customer/property tree): fetches the property's address & customer first. */
export function BuildingWizardForProperty({ propertyId, onClose, onDone, onSimpleForm }: { propertyId: string; onClose: () => void; onDone: (b: { id: string }) => void; onSimpleForm?: () => void }) {
  const [property, setProperty] = useState<PropertyForWizard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPropertyForBuildingWizard(propertyId)
      .then((p) => { if (cancelled) return; if (p) setProperty(p); else setError("Η ιδιοκτησία δεν βρέθηκε."); })
      .catch(() => { if (!cancelled) setError("Δεν ήταν δυνατή η φόρτωση της ιδιοκτησίας."); });
    return () => { cancelled = true; };
  }, [propertyId]);
  if (!property) return <LoadingModal title="Νέο κτήριο με τις μονάδες του" error={error} onClose={onClose} />;
  return <BuildingWizard property={property} onClose={onClose} onDone={onDone} onSimpleForm={onSimpleForm} />;
}

export function BuildingWizardLoader({ api }: { api: WizardHostApi }) {
  const [state, setState] = useState<{ property: PropertyForWizard | null; properties: { id: string; name: string; customerName: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const propertyId = api.ctx.propertyId ?? null;
  useEffect(() => {
    let cancelled = false;
    (propertyId ? getPropertyForBuildingWizard(propertyId).then((p) => ({ property: p, properties: [] })) : listPropertyOptions().then((properties) => ({ property: null, properties })))
      .then((st) => { if (!cancelled) setState(st); })
      .catch(() => { if (!cancelled) setError("Δεν ήταν δυνατή η φόρτωση των ιδιοκτησιών."); });
    return () => { cancelled = true; };
  }, [propertyId]);
  if (!state) return <LoadingModal title="Νέο κτήριο με τις μονάδες του" error={error} onClose={api.onClose} />;
  return <BuildingWizard property={state.property} properties={state.properties.map((p) => ({ id: p.id, name: `${p.name} — ${p.customerName}` }))} onClose={api.onClose} onDone={() => api.onDone("Το κτήριο και οι μονάδες του δημιουργήθηκαν.")} />;
}

export function ServiceWizardLoader({ api }: { api: WizardHostApi }) {
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof listServiceWizardContext>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    listServiceWizardContext().then((c) => { if (!cancelled) setCtx(c); }).catch(() => { if (!cancelled) setError("Δεν ήταν δυνατή η φόρτωση του καταλόγου."); });
    return () => { cancelled = true; };
  }, []);
  if (!ctx) return <LoadingModal title="Νέα υπηρεσία καταλόγου βήμα-βήμα" error={error} onClose={api.onClose} />;
  return <ServiceWizard zones={ctx.zones} takenCodes={ctx.takenCodes} onClose={api.onClose} onDone={(s) => api.onDone(`Η υπηρεσία «${s.name}» προστέθηκε.`)} />;
}

/** Package wizard for a known property: loads the server-computed package first. */
export function PackageWizardForProperty({ propertyId, propertyName, onClose, onDone }: { propertyId: string; propertyName?: string; onClose: () => void; onDone: (enabledIds: string[]) => void }) {
  const [view, setView] = useState<PackageView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    listPropertyPackage(propertyId).then((v) => { if (!cancelled) setView(v as PackageView); }).catch((e) => { if (!cancelled) setError(e instanceof Error && e.message === "Forbidden" ? "Δεν έχετε πρόσβαση στο πακέτο αυτής της ιδιοκτησίας." : "Δεν ήταν δυνατή η φόρτωση του πακέτου."); });
    return () => { cancelled = true; };
  }, [propertyId]);
  if (!view) return <LoadingModal title="Πακέτο υπηρεσιών ιδιοκτησίας" error={error} onClose={onClose} />;
  return <PackageWizard propertyId={propertyId} propertyName={propertyName} view={view} onClose={onClose} onDone={onDone} />;
}

export function PackageWizardLoader({ api }: { api: WizardHostApi }) {
  const [propertyId, setPropertyId] = useState<string | null>(api.ctx.propertyId ?? null);
  const [options, setOptions] = useState<{ id: string; name: string; customerName: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  useEffect(() => {
    if (propertyId) return;
    let cancelled = false;
    listPropertyOptions().then((rows) => { if (!cancelled) setOptions(rows); }).catch(() => { if (!cancelled) setError("Δεν ήταν δυνατή η φόρτωση των ιδιοκτησιών."); });
    return () => { cancelled = true; };
  }, [propertyId]);
  if (propertyId) return <PackageWizardForProperty propertyId={propertyId} propertyName={options?.find((o) => o.id === propertyId)?.name} onClose={api.onClose} onDone={() => api.onDone("Το πακέτο της ιδιοκτησίας ενημερώθηκε.")} />;
  if (!options) return <LoadingModal title="Πακέτο υπηρεσιών ιδιοκτησίας" error={error} onClose={api.onClose} />;
  return (
    <Modal open onClose={api.onClose} title="Πακέτο υπηρεσιών ιδιοκτησίας" width={520}
      footer={<button type="button" disabled={!pick} onClick={() => setPropertyId(pick)} style={{ minHeight: 40, padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: pick ? "pointer" : "default", opacity: pick ? 1 : 0.5, fontSize: "var(--fs-13)", fontWeight: 600 }}>Συνέχεια</button>}>
      <FormField label="Για ποια ιδιοκτησία;" required>
        <FieldSelect value={pick} onChange={setPick} placeholder="— Επιλογή ιδιοκτησίας —" options={options.map((o) => ({ value: o.id, label: `${o.name} — ${o.customerName}` }))} />
      </FormField>
    </Modal>
  );
}

export function SupplierWizardLoader({ api }: { api: WizardHostApi }) {
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof listSupplierWizardContext>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    listSupplierWizardContext().then((c) => { if (!cancelled) setCtx(c); }).catch(() => { if (!cancelled) setError("Δεν ήταν δυνατή η φόρτωση των κατηγοριών."); });
    return () => { cancelled = true; };
  }, []);
  if (!ctx) return <LoadingModal title="Νέος συνεργάτης βήμα-βήμα" error={error} onClose={api.onClose} />;
  return <SupplierWizard categories={ctx.categories} zones={ctx.zones} scope="company" onClose={api.onClose} onDone={(s) => api.onDone(`Ο συνεργάτης «${s.name}» καταχωρίστηκε.`)} />;
}
