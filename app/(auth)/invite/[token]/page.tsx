import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { inviteView } from "@/lib/supplier-invite-view";
import { inviteViewLimiter, RATE_LIMIT_MESSAGE } from "@/lib/invite-rate-limit";
import { ActivateForm } from "./ActivateForm";
import { RiLinkUnlinkM, RiTimeLine, RiCheckDoubleLine, RiUserForbidLine, RiShieldKeyholeLine } from "react-icons/ri";

export const metadata = { title: "Πρόσκληση συνεργάτη" };
export const dynamic = "force-dynamic";

/**
 * Landing page of every supplier e-mail link. Public (proxy.ts authPublicPaths).
 * Existing logins are sent to /login with the RFQ as callback; new people set a
 * password once and land on the offer form.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim() || "local";
  if (!inviteViewLimiter.allow(ip)) return <Card icon={<RiTimeLine />} title="Πολλές προσπάθειες" text={RATE_LIMIT_MESSAGE} />;

  const view = await inviteView(token);
  if (view.kind === "login") redirect(view.loginUrl);
  if (view.kind === "invalid") return <Card icon={<RiLinkUnlinkM />} title="Ο σύνδεσμος δεν ισχύει" text="Ο σύνδεσμος είναι λανθασμένος ή αντικαταστάθηκε από νεότερη πρόσκληση. Ζητήστε νέα πρόσκληση από την εταιρεία διαχείρισης." />;
  if (view.kind === "expired") return <Card icon={<RiTimeLine />} title="Ο σύνδεσμος έληξε" text="Οι σύνδεσμοι ισχύουν 14 ημέρες. Ζητήστε νέα πρόσκληση από την εταιρεία διαχείρισης." />;
  if (view.kind === "used") return <Card icon={<RiCheckDoubleLine />} title="Ο λογαριασμός έχει ήδη ενεργοποιηθεί" text="Συνδεθείτε με το email και τον κωδικό που ορίσατε." cta={{ href: "/login", label: "Σύνδεση" }} />;
  if (view.kind !== "activate") return <Card icon={<RiUserForbidLine />} title="Το email ανήκει σε άλλον λογαριασμό" text="Η διεύθυνση της πρόσκλησης χρησιμοποιείται ήδη από λογαριασμό άλλου τύπου (π.χ. ιδιοκτήτη ή διαχειριστή). Επικοινωνήστε με την εταιρεία διαχείρισης για να σταλεί η πρόσκληση σε άλλο email." />;

  return (
    <div style={shell}>
      <div style={{ ...card, maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <RiShieldKeyholeLine style={{ fontSize: "var(--fs-22)", color: "var(--color-primary)" }} />
          <h1 style={{ margin: 0, fontSize: "var(--fs-20)", fontWeight: 700 }}>Ορισμός κωδικού πρόσβασης</h1>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>
          Πρόσβαση στο περιβάλλον συνεργατών για την επιχείρηση <b style={{ color: "var(--foreground)" }}>{view.supplierName}</b>. Ο λογαριασμός σας είναι το <b style={{ color: "var(--foreground)" }}>{view.email}</b>.
        </p>
        <ActivateForm token={view.token} initialName={view.name} />
      </div>
    </div>
  );
}

function Card({ icon, title, text, cta }: { icon: React.ReactNode; title: string; text: string; cta?: { href: string; label: string } }) {
  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ fontSize: "var(--fs-28)", color: "var(--color-primary)", marginBottom: 8 }}>{icon}</div>
        <h1 style={{ margin: 0, fontSize: "var(--fs-19)", fontWeight: 700 }}>{title}</h1>
        <p style={{ margin: "8px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)", lineHeight: 1.6 }}>{text}</p>
        {cta && <Link href={cta.href} style={{ display: "inline-block", marginTop: 16, padding: "9px 18px", borderRadius: 999, background: "var(--primary)", color: "var(--primary-foreground)", fontSize: "var(--fs-13)", fontWeight: 600, textDecoration: "none" }}>{cta.label}</Link>}
      </div>
    </div>
  );
}

const shell: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--background)" };
const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "32px 36px", maxWidth: 440, width: "100%", textAlign: "left" };
