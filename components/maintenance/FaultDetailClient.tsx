"use client";

/**
 * Owns the shared work-action hook for the fault page: the header «Ενέργειες»
 * button, the panels' buttons and the dialog host all go through `wa`.
 */
import { useWorkActions } from "@/components/work/useWorkActions";
import { ActionsButton } from "@/components/work/ActionsButton";
import { subjectFromFaultDetail } from "@/lib/work/subjects";
import type { WorkActionViewer } from "@/lib/work/scope";
import type { RfqDTO, WorkOrderDTO } from "@/lib/rfq-shared";
import type { FaultDetail, Viewer } from "./types";
import { RequestDetail } from "./request-detail";
import { RfqPanel } from "./rfq-panel";

export function FaultDetailClient({ detail, viewer, legacyViewer, rfqPanel }: {
  detail: FaultDetail;
  viewer: WorkActionViewer;
  /** The RequestDetail viewer shape (isStaff/canManage/canAssign) — kept for the occupant/supplier consumers of that component. */
  legacyViewer: Viewer;
  rfqPanel: { rfqs: RfqDTO[]; workOrders: WorkOrderDTO[] } | null;
}) {
  const wa = useWorkActions({ viewer, where: "detail" });
  const subject = subjectFromFaultDetail(detail, rfqPanel);
  const open = (d: Parameters<typeof wa.open>[0]) => wa.open(d, subject);
  return (
    <>
      <RequestDetail request={detail} viewer={legacyViewer} actions={<ActionsButton subject={subject} api={wa} title={detail.title} />} onOpen={open} />
      {rfqPanel && (
        <RfqPanel rfqs={rfqPanel.rfqs} workOrders={rfqPanel.workOrders} canCreate={viewer.canRfqCreate} canEdit={viewer.canRfqEdit} canForward={viewer.canForward} canOnBehalf={viewer.canOnBehalf} onOpen={open} />
      )}
      {wa.host}
    </>
  );
}
