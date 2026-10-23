"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WIZARD_PARAM, isWizardKey, type WizardCtx, type WizardKey } from "@/lib/wizards/registry";

export type ActiveWizard = { key: WizardKey; ctx: WizardCtx };

const CTX_PARAMS = ["customerId", "propertyId", "buildingId"] as const;

/** Browser event a button can dispatch to open a wizard without navigating: `new CustomEvent(WIZARD_EVENT, { detail: { key, ctx } })`. */
export const WIZARD_EVENT = "orithon:wizard";

/**
 * Owns which (non-building) wizard is open. Honours `?wizard=<key>&customerId=…`
 * ONCE — state derived from the URL during render, like useBuildingActions — then
 * strips the params so Back/refresh don't reopen it. Keys outside `allowed`
 * (unknown or not permitted) are ignored silently; the URL is still cleaned.
 */
export function useWizardParam(allowed: WizardKey[]): { active: ActiveWizard | null; open: (key: WizardKey, ctx?: WizardCtx) => void; close: () => void } {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState<ActiveWizard | null>(null);

  const open = useCallback((key: WizardKey, ctx: WizardCtx = {}) => {
    if (!allowed.includes(key)) return;
    setActive({ key, ctx });
  }, [allowed]);
  const close = useCallback(() => setActive(null), []);

  const urlKey = search.get(WIZARD_PARAM);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  if (urlKey !== seenKey) {
    setSeenKey(urlKey);
    if (urlKey && isWizardKey(urlKey) && allowed.includes(urlKey)) {
      const ctx: WizardCtx = {};
      for (const k of CTX_PARAMS) { const v = search.get(k); if (v) ctx[k] = v; }
      setActive({ key: urlKey, ctx });
    }
  }
  useEffect(() => {
    if (!urlKey) return;
    const rest = new URLSearchParams(search.toString());
    rest.delete(WIZARD_PARAM);
    for (const k of CTX_PARAMS) rest.delete(k);
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [urlKey, search, pathname, router]);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent<{ key?: unknown; ctx?: WizardCtx }>).detail;
      if (d && isWizardKey(d.key)) open(d.key, d.ctx ?? {});
    };
    window.addEventListener(WIZARD_EVENT, onEvent);
    return () => window.removeEventListener(WIZARD_EVENT, onEvent);
  }, [open]);

  return { active, open, close };
}

/** Helper for buttons: open a wizard in place (no navigation). */
export function openWizard(key: WizardKey, ctx: WizardCtx = {}) {
  window.dispatchEvent(new CustomEvent(WIZARD_EVENT, { detail: { key, ctx } }));
}
