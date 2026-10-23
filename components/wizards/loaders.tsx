"use client";

/**
 * Loaders: fetch the small amount of context a wizard needs when it is opened
 * from a deep link (WizardHost) rather than from a page that already has the
 * data. Each renders a tiny loading modal, then the wizard.
 */
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { listManagerOptions, peekNextCustomerCode } from "@/app/actions/customers";
import { CustomerWizard } from "./CustomerWizard";
import type { WizardHostApi } from "./WizardHost";

export function LoadingModal({ title, error, onClose }: { title: string; error?: string | null; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={title} width={520}>
      <div style={{ padding: "12px 0", fontSize: "var(--fs-13-5)", color: error ? "#dc2626" : "var(--muted-foreground)" }} role={error ? "alert" : "status"}>
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
