import type { MetadataRoute } from "next";

/** Όνομα της εφαρμογής όταν δεν έχει οριστεί companyName (ή είναι το generic default). */
export const PWA_NAME_DEFAULT = "Orithon";
/** Κρεμ canvas (--bg-canvas): φόντο splash + χρώμα γραμμής κατάστασης. */
export const PWA_THEME = "#F6F4EC";
const GENERIC_DEFAULT_NAME = "PropertyPro";
const SHORT_NAME_MAX = 12;

export const PWA_ICONS: NonNullable<MetadataRoute.Manifest["icons"]> = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/** ≤ 12 χαρακτήρες· κόβει σε όριο λέξης όταν γίνεται, αλλιώς σκληρά. */
function shortName(name: string): string {
  if (name.length <= SHORT_NAME_MAX) return name;
  const head = name.slice(0, SHORT_NAME_MAX + 1);
  const lastSpace = head.lastIndexOf(" ");
  return (lastSpace > 0 ? head.slice(0, lastSpace) : name.slice(0, SHORT_NAME_MAX)).trimEnd();
}

/**
 * Το web app manifest. Καθαρή συνάρτηση ώστε να ελέγχεται χωρίς Next/DB·
 * το app/manifest.ts απλώς της δίνει τα AppSettings.
 * Το manifest ζητείται χωρίς cookies, άρα τα shortcuts είναι ουδέτερα ρόλου —
 * το /home στέλνει κάθε χρήστη στη δική του αρχική.
 */
export function buildManifest(input: { companyName?: string | null }): MetadataRoute.Manifest {
  const raw = (input.companyName ?? "").trim();
  const name = raw && raw !== GENERIC_DEFAULT_NAME ? raw : PWA_NAME_DEFAULT;
  const short_name = shortName(name);
  return {
    id: "/home",
    name,
    short_name,
    description: "Διαχείριση πολυκατοικιών: κοινόχρηστα, βλάβες, ανακοινώσεις, ραντεβού.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "el",
    dir: "ltr",
    background_color: PWA_THEME,
    theme_color: PWA_THEME,
    icons: PWA_ICONS,
    shortcuts: [
      { name: "Δήλωση βλάβης", url: "/report", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Αρχική", url: "/home", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
