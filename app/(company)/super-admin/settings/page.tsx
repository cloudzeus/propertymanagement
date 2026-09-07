import Link from "next/link";
import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import {
  RiSettingsLine, RiBuildingLine, RiPaletteLine, RiBankCardLine, RiFileTextLine, RiToolsLine, RiShieldUserLine, RiLinksLine,
  RiMoneyDollarCircleLine, RiLayoutLine, RiMailCheckLine, RiTeamLine, RiPriceTag3Line, RiArrowRightSLine,
} from "react-icons/ri";

export const metadata = { title: "Ρυθμίσεις" };

/** Settings hub: every configuration screen in one place, filtered by the viewer's permissions. */
export default async function SettingsPage() {
  await requirePermission("settings", "view");
  const resolved = await getEffectivePermissions();
  const perms = resolved?.perms ?? new Set<string>();
  const ok = (mod: string) => can(perms, mod, "view");

  const groups: { title: string; items: { href: string; label: string; desc: string; icon: React.ReactNode; mod: string }[] }[] = [
    {
      title: "Εταιρεία & εμφάνιση",
      items: [
        { href: "/super-admin/settings/company", label: "Εταιρία", desc: "Επωνυμία, ΑΦΜ, στοιχεία επικοινωνίας, τμήματα & θέσεις.", icon: <RiBuildingLine />, mod: "settings-company" },
        { href: "/super-admin/settings/brand", label: "Brand & εμφάνιση", desc: "Λογότυπα, χρώματα, στοιχεία που εμφανίζονται στα emails και στη Βοήθεια.", icon: <RiPaletteLine />, mod: "settings-brand" },
        { href: "/super-admin/roles", label: "Ρόλοι & δικαιώματα", desc: "Τι βλέπει και τι κάνει κάθε ρόλος· προσαρμοσμένοι ρόλοι.", icon: <RiShieldUserLine />, mod: "roles" },
      ],
    },
    {
      title: "Λειτουργία",
      items: [
        { href: "/admin/maintenance/settings", label: "Βλάβες & συντηρήσεις", desc: "Κατηγορίες, SLA, κανόνες κάλυψης της σύμβασης διαχείρισης.", icon: <RiToolsLine />, mod: "maintenance" },
        { href: "/super-admin/settings/contracts", label: "Προσφορές & συμβάσεις έργου", desc: "Περιθώριο, εγγύηση, σιωπηρή παραλαβή, πρότυπα συμβάσεων Α/Β.", icon: <RiFileTextLine />, mod: "settings-contracts" },
        { href: "/super-admin/suppliers/catalog", label: "Κατάλογος υπηρεσιών συνεργατών", desc: "Οι υπηρεσίες που «ανοίγει» η εταιρεία στους συνεργάτες.", icon: <RiTeamLine />, mod: "suppliers" },
        { href: "/super-admin/services", label: "Υπηρεσίες & πακέτα", desc: "Τι πουλάει η εταιρεία στους πελάτες της.", icon: <RiPriceTag3Line />, mod: "services" },
      ],
    },
    {
      title: "Πληρωμές & ενσωματώσεις",
      items: [
        { href: "/super-admin/settings/payments", label: "Πληρωμές (Viva)", desc: "Ο λογαριασμός εισπράξεων της εταιρείας.", icon: <RiBankCardLine />, mod: "settings-payments" },
        { href: "/super-admin/integrations", label: "Ενσωματώσεις", desc: "SoftOne, Bunny CDN, Daily, χάρτες και άλλα κλειδιά.", icon: <RiLinksLine />, mod: "integrations" },
        { href: "/super-admin/settings/costs", label: "Κόστη AI / API", desc: "Τι καταναλώνει η πλατφόρμα ανά υπηρεσία και πελάτη.", icon: <RiMoneyDollarCircleLine />, mod: "api-costs" },
      ],
    },
    {
      title: "Δημόσιο site",
      items: [
        { href: "/super-admin/cms/landing", label: "CMS — Αρχική & σελίδες", desc: "Περιεχόμενο, τιμές, FAQ, άρθρα, SEO, μεταφράσεις.", icon: <RiLayoutLine />, mod: "cms-landing" },
        { href: "/super-admin/cms/newsletter", label: "Newsletter & συναινέσεις (GDPR)", desc: "Συνδρομητές, φόρμα επικοινωνίας, demo — με το μητρώο συναινέσεων.", icon: <RiMailCheckLine />, mod: "cms-newsletter" },
      ],
    },
  ];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 700, margin: 0, color: "var(--foreground)" }}><RiSettingsLine style={{ color: "var(--color-primary)" }} /> Ρυθμίσεις</h1>
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Όλες οι ρυθμίσεις της πλατφόρμας σε ένα μέρος. Βλέπετε μόνο όσες επιτρέπει ο ρόλος σας.</p>
      </div>
      {groups.map((g) => {
        const items = g.items.filter((i) => ok(i.mod));
        if (items.length === 0) return null;
        return (
          <section key={g.title}>
            <h2 style={{ fontSize: "var(--fs-12)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)", margin: "0 0 10px" }}>{g.title}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {items.map((i) => (
                <Link key={i.href} href={i.href} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", textDecoration: "none", color: "var(--foreground)", minHeight: 44 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--paper)", border: "1px solid var(--border)", color: "var(--color-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-18)", flexShrink: 0 }}>{i.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "var(--fs-14)", fontWeight: 700 }}>{i.label}</span>
                    <span style={{ display: "block", fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", marginTop: 2 }}>{i.desc}</span>
                  </span>
                  <RiArrowRightSLine style={{ color: "var(--muted-foreground)", flexShrink: 0, marginTop: 10 }} />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
