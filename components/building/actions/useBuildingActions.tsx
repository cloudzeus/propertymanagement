"use client";

/**
 * One hook per building page: resolves the registry against the viewer's caps,
 * owns which modal is open, honours the `?action=<key>` deep link once (then
 * strips it from the URL) and renders the modal host + toast.
 *
 *   const ba = useBuildingActions({ data, can, workViewer, faultDetailBase: "/admin/maintenance" });
 *   <BuildingActionsMenu api={ba} />   …   {ba.host}
 */
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BuildingDashboardData } from "@/lib/building/dashboard-data";
import type { BuildingCaps } from "@/lib/building-caps";
import type { WorkActionViewer } from "@/lib/work/scope";
import type { AuditTab } from "@/lib/buildings/audit";
import { BUILDING_ACTION_PARAM, isBuildingActionKey, resolveBuildingActions, type BuildingAction, type BuildingActionKey } from "@/lib/building-actions";
import { ActionToast, type ToastMessage } from "@/components/work/ActionToast";
import { BuildingActionHost } from "./BuildingActionHost";

export type BuildingActionsApi = {
  buildingId: string;
  /** Allowed actions for this viewer on this building, in registry order. */
  actions: BuildingAction[];
  active: BuildingActionKey | null;
  open: (key: BuildingActionKey) => void;
  close: () => void;
  notify: (m: ToastMessage) => void;
  host: React.ReactNode;
};

export function useBuildingActions({ data, can, workViewer = null, superAdmin = false, faultDetailBase, onGoToTab }: {
  data: BuildingDashboardData;
  can: BuildingCaps;
  workViewer?: WorkActionViewer | null;
  /** The viewer is SUPER_ADMIN (building master-data edit is super-admin only). */
  superAdmin?: boolean;
  faultDetailBase: string;
  onGoToTab?: (tab: AuditTab) => void;
}): BuildingActionsApi {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [, startTransition] = useTransition();
  const [active, setActive] = useState<BuildingActionKey | null>(null);
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const actions = useMemo(
    () => resolveBuildingActions(can, { managed: data.building.propertyManaged, metered: data.usesMeteredHeating, hasWorkViewer: !!workViewer, superAdmin }),
    [can, data.building.propertyManaged, data.usesMeteredHeating, workViewer, superAdmin],
  );
  const allowed = useMemo(() => new Set(actions.map((a) => a.key)), [actions]);

  const open = useCallback((key: BuildingActionKey) => {
    if (!allowed.has(key)) return;
    if (key === "printables") { window.open(`/print?building=${encodeURIComponent(data.building.id)}`, "_blank", "noopener"); return; }
    setActive(key);
  }, [allowed, data.building.id]);
  const close = useCallback(() => setActive(null), []);
  const notify = useCallback((m: ToastMessage) => setMessage(m), []);

  // Deep link: /…/buildings/<id>?action=<key> → open once (state derived from the URL during render,
  // so a later client-side navigation to the same page with another ?action= works too), then drop the
  // param so Back/refresh don't reopen it.
  const urlKey = search.get(BUILDING_ACTION_PARAM);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  if (urlKey !== seenKey) {
    setSeenKey(urlKey);
    if (urlKey && isBuildingActionKey(urlKey) && allowed.has(urlKey)) {
      if (urlKey === "printables") open(urlKey); else setActive(urlKey);
    }
  }
  useEffect(() => {
    if (!urlKey) return;
    const rest = new URLSearchParams(search.toString());
    rest.delete(BUILDING_ACTION_PARAM);
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [urlKey, search, pathname, router]);

  const host = useMemo(() => (
    <>
      <BuildingActionHost
        active={active} data={data} can={can} workViewer={workViewer} faultDetailBase={faultDetailBase} onGoToTab={onGoToTab}
        onClose={close}
        onDone={(text) => { setActive(null); setMessage({ kind: "ok", text }); startTransition(() => router.refresh()); }}
      />
      <ActionToast message={message} onClose={() => setMessage(null)} />
    </>
  ), [active, data, can, workViewer, faultDetailBase, onGoToTab, close, message, router]);

  return { buildingId: data.building.id, actions, active, open, close, notify, host };
}
