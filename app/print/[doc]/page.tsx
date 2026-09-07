import { notFound, redirect } from "next/navigation";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { NoticeDoc } from "@/components/print/docs/Notice";
import { SummaryDoc } from "@/components/print/docs/Summary";
import { ExpensesDoc } from "@/components/print/docs/Expenses";
import { ReceiptDoc } from "@/components/print/docs/Receipt";
import { PaymentsDoc } from "@/components/print/docs/Payments";
import { ProposalDoc, type ProposalInput } from "@/components/print/docs/Proposal";
import { InvitationDoc, type InvitationInput } from "@/components/print/docs/Invitation";
import { MinutesDoc } from "@/components/print/docs/Minutes";
import { AnnouncementDoc } from "@/components/print/docs/Announcement";
import { getPrintBrand } from "@/lib/print/brand";
import { loadPrintBuilding, loadPeriod, loadPriorDues, loadAssembly, loadAnnouncement, listProposalSources } from "@/lib/print/data";
import { resolvePrintViewer, OCCUPANT_DOCS } from "@/lib/print/access";
import { printableHtml, textToParagraphs } from "@/lib/print/html";
import { DOCS, type DocKey } from "@/lib/print/registry";
import { monthLabel } from "@/lib/print/format";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
/** Default payment deadline: last day of the issuance month. */
const endOfMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo, 0, 12); };
/** n days from now (module-level so the render stays pure for the compiler lint). */
const inDays = (n: number) => new Date(Date.now() + n * 86400000);
const parseDate = (s: string) => { const d = s ? new Date(s) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };

export default async function PrintDocPage({ params, searchParams }: { params: Promise<{ doc: string }>; searchParams: Promise<SP> }) {
  const { doc } = await params;
  const sp = await searchParams;
  if (!(doc in DOCS)) notFound();
  const key = doc as DocKey;
  const buildingId = one(sp.building);
  if (!buildingId) redirect("/print");
  const viewer = await resolvePrintViewer(buildingId);
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/print/${doc}?building=${buildingId}`)}`);
  if (viewer.viewer === "occupant" && !OCCUPANT_DOCS.includes(key)) notFound();

  const [brand, building] = await Promise.all([getPrintBrand(), loadPrintBuilding(buildingId)]);
  if (!building) notFound();
  const month = /^\d{4}-\d{2}$/.test(one(sp.month)) ? one(sp.month) : building.months[0] ?? new Date().toISOString().slice(0, 7);
  const dueDate = parseDate(one(sp.due)) ?? endOfMonth(month);
  const back = `/print?building=${building.id}&month=${month}`;
  const title = `${DOCS[key].title} · ${building.name}`;

  // Occupants may only print notices for their own units.
  const ownUnitIds = viewer.viewer === "occupant" ? building.units.filter((u) => u.ownerId === viewer.userId || u.residentId === viewer.userId).map((u) => u.id) : null;

  let sheets: React.ReactNode = null;
  switch (key) {
    case "notice": {
      const period = await loadPeriod(building, month);
      const unitParam = one(sp.unit) || "all";
      let units = unitParam === "all" ? building.units : building.units.filter((u) => u.id === unitParam);
      if (ownUnitIds) units = units.filter((u) => ownUnitIds.includes(u.id));
      if (units.length === 0) notFound();
      sheets = units.map((u) => <NoticeDoc key={u.id} brand={brand} building={building} period={period} unit={u} statement={period.statements.find((s) => s.unitId === u.id)!} dueDate={dueDate} />);
      break;
    }
    case "summary": { const period = await loadPeriod(building, month); sheets = <SummaryDoc brand={brand} building={building} period={period} dueDate={dueDate} />; break; }
    case "expenses": { const period = await loadPeriod(building, month); sheets = <ExpensesDoc brand={brand} building={building} period={period} />; break; }
    case "payments": { const [period, prior] = await Promise.all([loadPeriod(building, month), loadPriorDues(building, month)]); sheets = <PaymentsDoc brand={brand} building={building} period={period} prior={prior} dueDate={dueDate} />; break; }
    case "receipt": {
      const period = await loadPeriod(building, month);
      const unit = building.units.find((u) => u.id === one(sp.unit));
      if (!unit) notFound();
      const party = one(sp.party) === "owner" ? "owner" : "tenant";
      sheets = <ReceiptDoc brand={brand} building={building} period={period} unit={unit} party={party} />;
      break;
    }
    case "proposal": {
      const woId = one(sp.wo);
      const wo = woId ? (await listProposalSources(building.id)).find((w) => w.id === woId) ?? null : null;
      const net = wo ? wo.net : Number(one(sp.net).replace(",", ".")) || 0;
      const p: ProposalInput = {
        title: one(sp.title) || wo?.title || "Πρόταση δαπάνης",
        description: one(sp.desc) || wo?.description || "",
        net, vatPct: one(sp.vat) !== "" ? Number(one(sp.vat)) : wo?.vatPct ?? 24,
        basis: (["GENERAL_MILLESIMES", "ELEVATOR_MILLESIMES", "HEATING_MILLESIMES", "EQUAL_PER_UNIT"].includes(one(sp.basis)) ? one(sp.basis) : "GENERAL_MILLESIMES") as ProposalInput["basis"],
        tenantPct: Math.min(100, Math.max(0, Number(one(sp.tenantPct)) || 0)),
        supplierName: one(sp.supplier) || wo?.supplierName || null,
        warrantyMonths: one(sp.warranty) !== "" ? Number(one(sp.warranty)) : wo?.warrantyMonths ?? null,
        reference: wo?.number ?? (one(sp.ref) || null),
        replyBy: parseDate(one(sp.replyBy)) ?? inDays(14),
        earliestDate: wo?.earliestDate ?? null,
      };
      sheets = <ProposalDoc brand={brand} building={building} p={p} />;
      break;
    }
    case "invitation": {
      const asmId = one(sp.assembly);
      const asm = asmId ? await loadAssembly(building.id, asmId) : null;
      const at = asm?.scheduledAt ?? parseDate(one(sp.date)) ?? inDays(10);
      const agenda = one(sp.agenda).split(/\r?\n|\|/).map((s) => s.trim()).filter(Boolean);
      const online = asm ? true : one(sp.place) === "" || one(sp.place) === "online";
      const inv: InvitationInput = {
        kind: one(sp.kind) === "Έκτακτη" ? "Έκτακτη" : "Τακτική",
        title: one(sp.title) || asm?.title || null,
        at, online,
        place: online ? "Ηλεκτρονικά, μέσω της εφαρμογής" : one(sp.place),
        agenda: agenda.length ? agenda : [asm?.title ?? "Ενημέρωση για τα οικονομικά της πολυκατοικίας", "Έγκριση απολογισμού και προϋπολογισμού", "Λοιπά θέματα"],
        repeatAt: one(sp.repeat) === "none" ? null : parseDate(one(sp.repeat)) ?? new Date(at.getTime() + 7 * 86400000),
      };
      sheets = <InvitationDoc brand={brand} building={building} inv={inv} />;
      break;
    }
    case "minutes": {
      const asm = await loadAssembly(building.id, one(sp.assembly));
      if (!asm) notFound();
      sheets = <MinutesDoc brand={brand} building={building} assembly={asm} />;
      break;
    }
    case "announcement": {
      const annId = one(sp.announcement);
      const ann = annId ? await loadAnnouncement(building.id, annId) : null;
      if (!ann && !one(sp.title)) notFound();
      sheets = <AnnouncementDoc brand={brand} building={building} a={{
        title: ann?.title ?? one(sp.title), html: ann ? printableHtml(ann.content) : textToParagraphs(one(sp.body)),
        date: ann?.publishedAt ?? ann?.createdAt ?? parseDate(one(sp.date)) ?? new Date(), audience: ann?.audience ?? (one(sp.audience) || "ALL"), sender: ann?.senderName ?? (one(sp.sender) || null),
      }} />;
      break;
    }
  }

  return (
    <>
      <PrintToolbar title={`${title}${["notice", "summary", "expenses", "payments", "receipt"].includes(key) ? ` · ${monthLabel(month)}` : ""}`} backHref={back} />
      {sheets}
    </>
  );
}
