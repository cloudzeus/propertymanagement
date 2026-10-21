"use client";

/**
 * Renders the dialog the hook opened: loads the context on open, re-validates
 * the dialog against it (rows can be stale), then shows the dialog component.
 */
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { loadWorkActionContext, type WorkActionContext } from "@/app/actions/work-actions";
import { callAction } from "@/lib/work/client-actions";
import { dialogAvailable, subjectFromContext } from "@/lib/work/dialog-guard";
import type { WorkDialog, WorkSubject } from "@/lib/work/actions";
import type { WorkActionViewer } from "@/lib/work/scope";
import type { FaultStatus } from "@/lib/maintenance-shared";
import type { DialogProps } from "./dialogs/shared";
import { btn } from "./dialogs/shared";
import { AssignEmployeeDialog } from "./dialogs/AssignEmployeeDialog";
import { AssignSupplierDialog } from "./dialogs/AssignSupplierDialog";
import { StatusNoteDialog } from "./dialogs/StatusNoteDialog";
import { CommentDialog } from "./dialogs/CommentDialog";
import { RateSupplierDialog } from "./dialogs/RateSupplierDialog";
import { CancelRfqDialog } from "./dialogs/CancelRfqDialog";
import { AppointmentDialog } from "./dialogs/AppointmentDialog";
import { CreateRfqDialog } from "./dialogs/CreateRfqDialog";
import { AddRfqSuppliersDialog } from "./dialogs/AddRfqSuppliersDialog";
import { ForwardOfferDialog } from "./dialogs/ForwardOfferDialog";
import { WoRespondDialog } from "./dialogs/WoRespondDialog";
import { WoScheduleDialog } from "./dialogs/WoScheduleDialog";
import { WoConfirmDialog } from "./dialogs/WoConfirmDialog";

export type OpenRequest = { dialog: WorkDialog; subject: WorkSubject; status?: FaultStatus; batchIds?: string[] };

const DIALOGS: Record<WorkDialog, React.ComponentType<DialogProps>> = {
  "assign-employee": AssignEmployeeDialog,
  "assign-supplier": AssignSupplierDialog,
  "status-note": StatusNoteDialog,
  comment: CommentDialog,
  "rate-supplier": RateSupplierDialog,
  "cancel-rfq": CancelRfqDialog,
  appointment: AppointmentDialog,
  "create-rfq": CreateRfqDialog,
  "add-rfq-suppliers": AddRfqSuppliersDialog,
  "forward-offer": ForwardOfferDialog,
  "wo-respond": WoRespondDialog,
  "wo-schedule": WoScheduleDialog,
  "wo-confirm": WoConfirmDialog,
};

export function WorkActionHost({ request, viewer, onDone, onClose }: { request: OpenRequest | null; viewer: WorkActionViewer; onDone: (message: string) => void; onClose: () => void }) {
  const [state, setState] = useState<{ key: string; ctx: WorkActionContext | null; error: string | null }>({ key: "", ctx: null, error: null });
  const key = request ? `${request.dialog}:${request.subject.kind}:${request.subject.id}:${request.batchIds?.join(",") ?? ""}` : "";

  useEffect(() => {
    if (!request) return;
    let alive = true;
    const { subject } = request;
    void callAction(() => loadWorkActionContext({ kind: subject.kind, id: subject.id })).then((res) => {
      if (!alive) return;
      if ("error" in res && res.error) setState({ key, ctx: null, error: res.error });
      else setState({ key, ctx: res as WorkActionContext, error: null });
    });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key identifies the request

  if (!request) return null;
  const loaded = state.key === key;
  const title = "Ενέργεια";

  if (!loaded) {
    return <Modal open title={title} onClose={onClose}><p style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Φόρτωση…</p></Modal>;
  }
  if (state.error || !state.ctx) {
    return (
      <Modal open title={title} onClose={onClose} footer={<button type="button" style={btn} onClick={onClose}>Κλείσιμο</button>}>
        <p role="alert" style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--destructive)" }}>{state.error ?? "Η φόρτωση απέτυχε."}</p>
      </Modal>
    );
  }
  const fresh = request.batchIds ? request.subject : subjectFromContext(request.subject, state.ctx);
  if (!request.batchIds && !dialogAvailable(request.dialog, fresh, viewer)) {
    return (
      <Modal open title={title} onClose={onClose} footer={<button type="button" style={btn} onClick={onClose}>Κλείσιμο</button>}>
        <p style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--foreground)" }}>Η ενέργεια δεν είναι πλέον διαθέσιμη — η εγγραφή άλλαξε.</p>
      </Modal>
    );
  }
  const Dialog = DIALOGS[request.dialog];
  if (!Dialog) {
    return (
      <Modal open title={title} onClose={onClose} footer={<button type="button" style={btn} onClick={onClose}>Κλείσιμο</button>}>
        <p style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Ο διάλογος δεν είναι διαθέσιμος ακόμη.</p>
      </Modal>
    );
  }
  return <Dialog key={key} ctx={state.ctx} subject={fresh} status={request.status} batchIds={request.batchIds} onDone={onDone} onClose={onClose} />;
}
