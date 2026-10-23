"use client";

/**
 * Renders the open (non-building) guided wizard anywhere in the company
 * surface — mounted once in the AppShell. Building-scope wizards (χιλιοστά,
 * κοινόχρηστος χώρος, συντήρηση, ανακοίνωση, συνέλευση, ιδιοκτήτης/ένοικος)
 * open on the building page through its «Ενέργειες» registry instead
 * (lib/building-actions `wizard` field), where BuildingCaps and the
 * building's data live.
 *
 * Each wizard case is added by its own task; until then the key is a no-op.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WizardCtx, WizardKey } from "@/lib/wizards/registry";
import { ActionToast, type ToastMessage } from "@/components/work/ActionToast";
import { useWizardParam } from "./useWizardParam";
import { CustomerWizardLoader } from "./loaders";

export type WizardHostApi = {
  ctx: WizardCtx;
  onClose: () => void;
  /** After a successful save: close, toast, refresh server data. */
  onDone: (text: string) => void;
};

export function WizardHost({ allowed }: { allowed: WizardKey[] }) {
  const { active, close } = useWizardParam(allowed);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const api: WizardHostApi | null = active ? {
    ctx: active.ctx,
    onClose: close,
    onDone: (text) => { close(); setMessage({ kind: "ok", text }); startTransition(() => router.refresh()); },
  } : null;

  return (
    <>
      {active && api && <ActiveWizard key={`${active.key}:${JSON.stringify(active.ctx)}`} active={active.key} api={api} />}
      <ActionToast message={message} onClose={() => setMessage(null)} />
    </>
  );
}

function ActiveWizard({ active, api }: { active: WizardKey; api: WizardHostApi }) {
  switch (active) {
    case "customer-new":
      return <CustomerWizardLoader api={api} />;
    // further cases are added per wizard (Tasks 8–14)
    default:
      return null;
  }
}
