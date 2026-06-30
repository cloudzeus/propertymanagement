"use client";

import { useState, useTransition } from "react";
import { RiSettings3Line } from "react-icons/ri";
import { updateSiteSettings } from "@/app/actions/site-settings";
import type { ConsentConfig } from "@/lib/cms/site-settings-defaults";
import {
  CmsPage,
  CmsCard,
  CmsField,
  CmsInput,
  CmsTextarea,
  LocaleTabs,
  SaveBar,
} from "@/components/cms/ui";

type Initial = {
  siteName: string;
  defaultOgImage: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  xUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  facebookPixelId: string;
  extraHeadHtml: string;
  extraBodyHtml: string;
  googleSiteVerification: string;
  bingSiteVerification: string;
  geoLat: string;
  geoLng: string;
  addrStreet: string;
  addrCity: string;
  addrPostal: string;
  addrCountry: string;
  telephone: string;
  openingHours: string;
  consentEnabled: boolean;
  consentConfig: ConsentConfig;
};

type ScalarKey = Exclude<keyof Initial, "consentEnabled" | "consentConfig">;

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const [f, setF] = useState<Record<ScalarKey, string>>(() => {
    const { consentEnabled, consentConfig, ...rest } = initial;
    return rest as Record<ScalarKey, string>;
  });
  const [consentEnabled, setConsentEnabled] = useState(initial.consentEnabled);
  const [consent, setConsent] = useState<ConsentConfig>(initial.consentConfig);
  const [categoriesJson, setCategoriesJson] = useState(() =>
    JSON.stringify(initial.consentConfig.categories ?? [], null, 2),
  );
  const [tab, setTab] = useState<"el" | "en">("el");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (k: ScalarKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setF((p) => ({ ...p, [k]: e.target.value }));
  };

  const setConsentText = (
    field: "title" | "body",
    locale: "el" | "en",
    value: string,
  ) => {
    setConsent((p) => ({ ...p, [field]: { ...p[field], [locale]: value } }));
  };

  const Text = (k: ScalarKey, label: string) => (
    <CmsField label={label}>
      <CmsInput value={f[k]} onChange={set(k)} />
    </CmsField>
  );

  function save() {
    setError(null);
    setSaved(false);

    let categories: ConsentConfig["categories"];
    try {
      const parsed = JSON.parse(categoriesJson);
      if (!Array.isArray(parsed)) throw new Error("Πρέπει να είναι πίνακας (array).");
      categories = parsed;
    } catch (err) {
      setError(`Σφάλμα στο JSON κατηγοριών consent: ${(err as Error).message}`);
      return;
    }

    const numOrNull = (v: string) => {
      const t = v.trim();
      if (t === "") return null;
      const num = Number(t);
      return Number.isFinite(num) ? num : null;
    };
    const strOrNull = (v: string) => {
      const t = v.trim();
      return t === "" ? null : t;
    };

    const payload: Record<string, unknown> = {
      siteName: strOrNull(f.siteName),
      defaultOgImage: strOrNull(f.defaultOgImage),
      facebookUrl: strOrNull(f.facebookUrl),
      instagramUrl: strOrNull(f.instagramUrl),
      linkedinUrl: strOrNull(f.linkedinUrl),
      xUrl: strOrNull(f.xUrl),
      youtubeUrl: strOrNull(f.youtubeUrl),
      tiktokUrl: strOrNull(f.tiktokUrl),
      googleAnalyticsId: strOrNull(f.googleAnalyticsId),
      googleTagManagerId: strOrNull(f.googleTagManagerId),
      facebookPixelId: strOrNull(f.facebookPixelId),
      extraHeadHtml: strOrNull(f.extraHeadHtml),
      extraBodyHtml: strOrNull(f.extraBodyHtml),
      googleSiteVerification: strOrNull(f.googleSiteVerification),
      bingSiteVerification: strOrNull(f.bingSiteVerification),
      geoLat: numOrNull(f.geoLat),
      geoLng: numOrNull(f.geoLng),
      addrStreet: strOrNull(f.addrStreet),
      addrCity: strOrNull(f.addrCity),
      addrPostal: strOrNull(f.addrPostal),
      addrCountry: strOrNull(f.addrCountry),
      telephone: strOrNull(f.telephone),
      openingHours: strOrNull(f.openingHours),
      consentEnabled,
      consentConfig: { ...consent, categories },
    };

    startTransition(async () => {
      try {
        await updateSiteSettings(payload);
        setSaved(true);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <CmsPage
      icon={<RiSettings3Line />}
      title="Ρυθμίσεις ιστότοπου"
      subtitle="Social, analytics, consent, SEO & GEO"
    >
      <CmsCard title="SEO">
        <div style={grid2}>
          {Text("siteName", "Όνομα ιστότοπου")}
          {Text("defaultOgImage", "Προεπιλεγμένη εικόνα OG (URL)")}
        </div>
      </CmsCard>

      <CmsCard title="Social">
        <div style={grid2}>
          {Text("facebookUrl", "Facebook URL")}
          {Text("instagramUrl", "Instagram URL")}
          {Text("linkedinUrl", "LinkedIn URL")}
          {Text("xUrl", "X (Twitter) URL")}
          {Text("youtubeUrl", "YouTube URL")}
          {Text("tiktokUrl", "TikTok URL")}
        </div>
      </CmsCard>

      <CmsCard title="Analytics & Tags">
        <div style={grid2}>
          {Text("googleAnalyticsId", "Google Analytics ID")}
          {Text("googleTagManagerId", "Google Tag Manager ID")}
          {Text("facebookPixelId", "Facebook Pixel ID")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          <CmsField label="Extra HTML (head)">
            <CmsTextarea
              mono
              style={{ minHeight: 100 }}
              value={f.extraHeadHtml}
              onChange={set("extraHeadHtml")}
            />
          </CmsField>
          <CmsField label="Extra HTML (body)">
            <CmsTextarea
              mono
              style={{ minHeight: 100 }}
              value={f.extraBodyHtml}
              onChange={set("extraBodyHtml")}
            />
          </CmsField>
        </div>
      </CmsCard>

      <CmsCard title="Επαλήθευση">
        <div style={grid2}>
          {Text("googleSiteVerification", "Google site verification")}
          {Text("bingSiteVerification", "Bing site verification")}
        </div>
      </CmsCard>

      <CmsCard title="GEO / Τοπική επιχείρηση">
        <div style={grid2}>
          {Text("telephone", "Τηλέφωνο")}
          {Text("addrStreet", "Οδός")}
          {Text("addrCity", "Πόλη")}
          {Text("addrPostal", "Τ.Κ.")}
          {Text("addrCountry", "Χώρα")}
          {Text("geoLat", "Γεωγραφικό πλάτος (lat)")}
          {Text("geoLng", "Γεωγραφικό μήκος (lng)")}
        </div>
        <div style={{ marginTop: 16 }}>
          <CmsField label="Ώρες λειτουργίας">
            <CmsInput value={f.openingHours} onChange={set("openingHours")} />
          </CmsField>
        </div>
      </CmsCard>

      <CmsCard title="Consent (cookie banner)">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 18,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--foreground)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={consentEnabled}
            onChange={(e) => setConsentEnabled(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Ενεργοποίηση consent banner
        </label>

        <div style={{ marginBottom: 18 }}>
          <LocaleTabs value={tab} onChange={setTab} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CmsField label={`Τίτλος (${tab.toUpperCase()})`}>
            <CmsInput
              value={consent.title[tab]}
              onChange={(e) => setConsentText("title", tab, e.target.value)}
            />
          </CmsField>
          <CmsField label={`Κείμενο (${tab.toUpperCase()})`}>
            <CmsTextarea
              style={{ minHeight: 80 }}
              value={consent.body[tab]}
              onChange={(e) => setConsentText("body", tab, e.target.value)}
            />
          </CmsField>
          <CmsField label="Σύνδεσμος πολιτικής (policyLink)">
            <CmsInput
              value={consent.policyLink}
              onChange={(e) => setConsent((p) => ({ ...p, policyLink: e.target.value }))}
            />
          </CmsField>
          <CmsField label="Κατηγορίες (JSON array)">
            <CmsTextarea
              mono
              style={{ minHeight: 180 }}
              value={categoriesJson}
              onChange={(e) => setCategoriesJson(e.target.value)}
            />
          </CmsField>
        </div>
      </CmsCard>

      {error && (
        <div
          style={{
            border: "1px solid var(--color-danger)",
            background: "color-mix(in srgb, var(--color-danger) 8%, white)",
            color: "var(--color-danger)",
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <SaveBar onSave={save} pending={pending} saved={saved} />
    </CmsPage>
  );
}
