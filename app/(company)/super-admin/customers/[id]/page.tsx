import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  RiArrowLeftLine, RiContactsLine, RiCommunityLine, RiMapPin2Line, RiAddLine, RiArrowRightSLine,
  RiWalletLine, RiBankCardLine, RiStackLine, RiCheckboxCircleLine, RiCloseCircleLine,
  RiMailLine, RiPhoneLine, RiGlobalLine, RiTimeLine, RiFlashlightLine,
} from "react-icons/ri";

export const metadata = { title: "Καρτέλα Πελάτη — Super Admin" };

const TYPE_LABEL: Record<string, string> = { INDIVIDUAL: "Ιδιώτης", COMPANY: "Εταιρεία" };

const INVOICE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "Εκκρεμεί",   color: "#B45309", bg: "#B4530915" },
  PAID:      { label: "Εξοφλήθη",   color: "#15803D", bg: "#15803D15" },
  OVERDUE:   { label: "Ληξιπρόθεσμο", color: "#B91C1C", bg: "#B91C1C15" },
  CANCELLED: { label: "Ακυρώθηκε",  color: "#6B7280", bg: "#6B728015" },
};

const PRICING_LABEL: Record<string, string> = {
  PER_UNIT: "ανά μονάδα / μήνα",
  PER_BUILDING: "ανά κτήριο / μήνα",
  PER_COMMON_AREA: "ανά κοινόχρηστο χώρο / μήνα",
  FLAT: "πάγιο / μήνα",
  METERED_PREPAID: "μετρούμενη (προπληρωμή)",
};

const eur = (n: number) =>
  n.toLocaleString("el-GR", { style: "currency", currency: "EUR" });
const dt = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      meteredPlan: true,
      invoices: {
        orderBy: { period: "desc" },
        take: 24,
        include: { lines: { select: { id: true } } },
      },
      properties: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { buildings: true } },
          buildings: { select: { _count: { select: { units: true } } } },
          services: {
            orderBy: { createdAt: "asc" },
            include: { service: { select: { name: true, code: true, pricingModel: true, price: true, isCore: true } } },
          },
        },
      },
    },
  });
  if (!customer) notFound();

  const wallet = await db.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "CUSTOMER", ownerId: customer.id } },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 6 } },
  });
  const walletTxns = wallet?.transactions ?? [];

  const totalUnits = customer.properties.reduce(
    (s, p) => s + p.buildings.reduce((a, b) => a + b._count.units, 0), 0);
  const totalBuildings = customer.properties.reduce((s, p) => s + p._count.buildings, 0);

  const subscriptions = customer.properties.flatMap((p) => {
    const unitsCount = p.buildings.reduce((a, b) => a + b._count.units, 0);
    return p.services.map((ps) => ({
      ...ps, propertyName: p.name, unitsCount, buildingsCount: p._count.buildings,
    }));
  });
  const activeSubs = subscriptions.filter((s) => s.active);
  const monthlyEstimate = activeSubs.reduce((sum, s) => {
    const price = Number(s.service.price);
    switch (s.service.pricingModel) {
      case "PER_UNIT": return sum + price * s.unitsCount;
      case "PER_BUILDING": return sum + price * s.buildingsCount;
      case "FLAT": return sum + price;
      default: return sum; // METERED_PREPAID / PER_COMMON_AREA (count not loaded)
    }
  }, 0);

  const invoices = customer.invoices;
  const outstanding = invoices
    .filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
    .reduce((s, i) => s + Number(i.amount), 0);
  const paidTotal = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.amount), 0);

  const rows: [string, string | null][] = [
    ["ΑΦΜ", customer.afm], ["ΔΟΥ", customer.doy],
    ["Email", customer.email], ["Τηλ. 1", customer.phone], ["Τηλ. 2", customer.phone2],
    ["Fax", customer.fax], ["Ιστοσελίδα", customer.webpage],
  ];
  const addr = [customer.address, customer.city, customer.district, customer.postalCode, customer.country].filter(Boolean).join(", ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Link href="/super-admin/customers" style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none", width: "fit-content" }}>
        <RiArrowLeftLine /> Πίσω στους Πελάτες
      </Link>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, background: "var(--color-primary)18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RiContactsLine style={{ fontSize: 26, color: "var(--color-primary)" }} />
        </div>
        <div style={{ minWidth: 200 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            {customer.name}
            {customer.isActive ? (
              <span style={{ ...pill, background: "#15803D15", color: "#15803D" }}><RiCheckboxCircleLine /> Ενεργός</span>
            ) : (
              <span style={{ ...pill, background: "#B91C1C15", color: "#B91C1C" }}><RiCloseCircleLine /> Ανενεργός</span>
            )}
          </h1>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ ...pill, background: customer.type === "COMPANY" ? "#8764B818" : "#0078D418", color: customer.type === "COMPANY" ? "#8764B8" : "#0078D4" }}>
              {TYPE_LABEL[customer.type] ?? customer.type}
            </span>
            {customer.code && <span style={{ fontFamily: "monospace" }}>{customer.code}</span>}
            {customer.email && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><RiMailLine /> {customer.email}</span>}
            {customer.phone && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><RiPhoneLine /> {customer.phone}</span>}
            {customer.webpage && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><RiGlobalLine /> {customer.webpage}</span>}
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 0, flexWrap: "wrap" }}>
          {[
            { label: "Ιδιοκτησίες", val: String(customer.properties.length) },
            { label: "Κτήρια", val: String(totalBuildings) },
            { label: "Μονάδες", val: String(totalUnits) },
            { label: "Ενεργές Συνδρομές", val: String(activeSubs.length) },
            { label: "Οφειλές", val: eur(outstanding), color: outstanding > 0 ? "#B91C1C" : "#15803D" },
          ].map((s, i) => (
            <div key={s.label} style={{ textAlign: "center", padding: "0 18px", borderLeft: i > 0 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: s.color ?? "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main 3-column grid ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>

        {/* Column 1: Στοιχεία + Διεύθυνση + Wallet */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={cardStyle}>
            <h3 style={cardTitle}>Στοιχεία</h3>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "7px 14px", fontSize: 13 }}>
              {rows.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <span style={{ color: "var(--muted-foreground)" }}>{k}</span>
                  <span style={{ color: "var(--foreground)", fontWeight: 500, overflowWrap: "anywhere" }}>{v || "—"}</span>
                </div>
              ))}
            </div>
            <h3 style={{ ...cardTitle, marginTop: 16 }}>Διεύθυνση</h3>
            <p style={{ fontSize: 13, color: "var(--foreground)", margin: 0 }}>{addr || "—"}</p>
            {customer.lat != null && customer.lng != null && (
              <p style={{ fontSize: 12, color: "#16a34a", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <RiMapPin2Line /> {customer.lat.toFixed(6)}, {customer.lng.toFixed(6)}
              </p>
            )}
            {customer.remarks && (
              <>
                <h3 style={{ ...cardTitle, marginTop: 16 }}>Παρατηρήσεις</h3>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{customer.remarks}</p>
              </>
            )}
          </div>

          {/* Wallet */}
          <div style={cardStyle}>
            <h3 style={{ ...cardTitle, display: "flex", alignItems: "center", gap: 6 }}><RiWalletLine /> Πορτοφόλι AI/API</h3>
            {wallet ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: Number(wallet.balanceEur) > 0 ? "var(--foreground)" : "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                    {eur(Number(wallet.balanceEur))}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>υπόλοιπο</span>
                </div>
                {customer.meteredPlan && (
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "8px 0 0", display: "flex", alignItems: "center", gap: 5 }}>
                    <RiFlashlightLine />
                    Μηνιαίο όριο {eur(Number(customer.meteredPlan.monthlyAllowanceEur))}
                    {customer.meteredPlan.rollover ? " · με μεταφορά" : ""}
                    {!customer.meteredPlan.active ? " · ανενεργό" : ""}
                  </p>
                )}
                {walletTxns && walletTxns.length > 0 && (
                  <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    {walletTxns.map((t) => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 0" }}>
                        <RiTimeLine style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                        <span style={{ color: "var(--muted-foreground)", flexShrink: 0 }}>{dt(t.createdAt)}</span>
                        <span style={{ color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</span>
                        <span style={{ marginLeft: "auto", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: Number(t.amountEur) >= 0 ? "#15803D" : "#B91C1C", flexShrink: 0 }}>
                          {Number(t.amountEur) >= 0 ? "+" : ""}{eur(Number(t.amountEur))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>Δεν έχει δημιουργηθεί πορτοφόλι.</p>
            )}
          </div>
        </div>

        {/* Column 2: Συνδρομές / Υπηρεσίες */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ ...cardTitle, margin: 0, display: "flex", alignItems: "center", gap: 6 }}><RiStackLine /> Συνδρομές &amp; Υπηρεσίες</h3>
            {monthlyEstimate > 0 && (
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                ~<strong style={{ color: "var(--foreground)" }}>{eur(monthlyEstimate)}</strong>/μήνα
              </span>
            )}
          </div>
          {subscriptions.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>Δεν υπάρχουν ενεργοποιημένες υπηρεσίες.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {subscriptions.map((s) => (
                <div key={s.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", opacity: s.active ? 1 : 0.6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{s.service.name}</span>
                    {s.service.isCore && <span style={{ ...pill, background: "var(--color-primary)15", color: "var(--color-primary)" }}>CORE</span>}
                    <span style={{ marginLeft: "auto", ...pill, background: s.active ? "#15803D15" : "#6B728015", color: s.active ? "#15803D" : "#6B7280" }}>
                      {s.active ? "Ενεργή" : "Ανενεργή"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted-foreground)", marginTop: 5, flexWrap: "wrap" }}>
                    <span>{s.propertyName}</span>
                    <span>·</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {eur(Number(s.service.price))} <span>{PRICING_LABEL[s.service.pricingModel] ?? s.service.pricingModel}</span>
                    </span>
                    {s.service.pricingModel === "METERED_PREPAID" && (
                      <span>· υπόλοιπο {s.prepaidPersonMinutes} λεπτά-ατόμου</span>
                    )}
                    {s.startedAt && <span>· από {dt(s.startedAt)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: Τιμολόγια / Πληρωμές */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ ...cardTitle, margin: 0, display: "flex", alignItems: "center", gap: 6 }}><RiBankCardLine /> Τιμολόγια &amp; Πληρωμές</h3>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Εξοφλημένα <strong style={{ color: "#15803D" }}>{eur(paidTotal)}</strong>
            </span>
          </div>
          {invoices.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>Δεν έχουν εκδοθεί τιμολόγια.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {invoices.map((inv, i) => {
                const st = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.PENDING;
                return (
                  <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
                    <span style={{ fontFamily: "monospace", color: "var(--foreground)", fontWeight: 600, flexShrink: 0 }}>{inv.period}</span>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {inv.lines.length} γραμμ{inv.lines.length === 1 ? "ή" : "ές"}
                      {inv.status === "PAID" && inv.paidAt ? ` · ${dt(inv.paidAt)}` : inv.dueDate ? ` · έως ${dt(inv.dueDate)}` : ""}
                    </span>
                    <span style={{ marginLeft: "auto", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--foreground)", flexShrink: 0 }}>{eur(Number(inv.amount))}</span>
                    <span style={{ ...pill, background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Ιδιοκτησίες ────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Ιδιοκτησίες</h3>
          <Link href="/super-admin/properties" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "var(--color-primary)", color: "#fff", textDecoration: "none" }}>
            <RiAddLine /> Νέα Ιδιοκτησία
          </Link>
        </div>
        {customer.properties.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", color: "var(--muted-foreground)", padding: "36px" }}>
            <RiCommunityLine style={{ fontSize: 32, opacity: 0.4, display: "block", margin: "0 auto 10px" }} />
            <p style={{ fontSize: 13, margin: 0 }}>Δεν υπάρχουν ιδιοκτησίες για αυτόν τον πελάτη.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {customer.properties.map((p) => {
              const units = p.buildings.reduce((a, b) => a + b._count.units, 0);
              const activeServices = p.services.filter((s) => s.active).length;
              return (
                <Link key={p.id} href={`/super-admin/properties/${p.id}`} style={{ ...cardStyle, textDecoration: "none", display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <RiCommunityLine style={{ color: "var(--color-primary)" }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{p.name}</span>
                    <RiArrowRightSLine style={{ marginLeft: "auto", color: "var(--muted-foreground)" }} />
                  </div>
                  {(p.address || p.city) && (
                    <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
                      {[p.address, p.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--muted-foreground)" }}>
                    <span><strong style={{ color: "var(--foreground)" }}>{p._count.buildings}</strong> κτήρια</span>
                    <span><strong style={{ color: "var(--foreground)" }}>{units}</strong> μονάδες</span>
                    <span><strong style={{ color: "var(--foreground)" }}>{activeServices}</strong> υπηρεσίες</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 18px" };
const cardTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" };
const pill: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 };
