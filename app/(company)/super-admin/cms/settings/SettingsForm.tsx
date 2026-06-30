"use client";

import { useState, useTransition } from "react";
import { updateSiteSettings } from "@/app/actions/site-settings";
import type { ConsentConfig } from "@/lib/cms/site-settings-defaults";

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

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

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

  const Text = (k: ScalarKey, label: string, full?: boolean) => (
    <Field label={label} full={full}>
      <input className={inputCls} value={f[k]} onChange={set(k)} />
    </Field>
  );

  const Area = (k: ScalarKey, label: string) => (
    <Field label={label} full>
      <textarea className={`${inputCls} min-h-[100px] font-mono`} value={f[k]} onChange={set(k)} />
    </Field>
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <form onSubmit={onSubmit} className="space-y-6">
      <Card title="SEO">
        {Text("siteName", "Όνομα ιστότοπου")}
        {Text("defaultOgImage", "Προεπιλεγμένη εικόνα OG (URL)")}
      </Card>

      <Card title="Social">
        {Text("facebookUrl", "Facebook URL")}
        {Text("instagramUrl", "Instagram URL")}
        {Text("linkedinUrl", "LinkedIn URL")}
        {Text("xUrl", "X (Twitter) URL")}
        {Text("youtubeUrl", "YouTube URL")}
        {Text("tiktokUrl", "TikTok URL")}
      </Card>

      <Card title="Analytics / Tags">
        {Text("googleAnalyticsId", "Google Analytics ID")}
        {Text("googleTagManagerId", "Google Tag Manager ID")}
        {Text("facebookPixelId", "Facebook Pixel ID")}
        {Area("extraHeadHtml", "Extra HTML (head)")}
        {Area("extraBodyHtml", "Extra HTML (body)")}
      </Card>

      <Card title="Επαλήθευση (Verification)">
        {Text("googleSiteVerification", "Google site verification")}
        {Text("bingSiteVerification", "Bing site verification")}
      </Card>

      <Card title="GEO / Τοπική επιχείρηση">
        {Text("telephone", "Τηλέφωνο")}
        {Text("addrStreet", "Οδός")}
        {Text("addrCity", "Πόλη")}
        {Text("addrPostal", "Τ.Κ.")}
        {Text("addrCountry", "Χώρα")}
        {Text("geoLat", "Γεωγραφικό πλάτος (lat)")}
        {Text("geoLng", "Γεωγραφικό μήκος (lng)")}
        {Text("openingHours", "Ώρες λειτουργίας", true)}
      </Card>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Consent</h2>

        <label className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={consentEnabled}
            onChange={(e) => setConsentEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm font-medium text-slate-700">Ενεργοποίηση consent banner</span>
        </label>

        <div className="mb-4 flex gap-1">
          {(["el", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setTab(l)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === l ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Field label={`Τίτλος (${tab.toUpperCase()})`}>
            <input
              className={inputCls}
              value={consent.title[tab]}
              onChange={(e) => setConsentText("title", tab, e.target.value)}
            />
          </Field>
          <Field label={`Κείμενο (${tab.toUpperCase()})`}>
            <textarea
              className={`${inputCls} min-h-[80px]`}
              value={consent.body[tab]}
              onChange={(e) => setConsentText("body", tab, e.target.value)}
            />
          </Field>
          <Field label="Σύνδεσμος πολιτικής (policyLink)">
            <input
              className={inputCls}
              value={consent.policyLink}
              onChange={(e) => setConsent((p) => ({ ...p, policyLink: e.target.value }))}
            />
          </Field>
          <Field label="Κατηγορίες (JSON array)">
            <textarea
              className={`${inputCls} min-h-[180px] font-mono`}
              value={categoriesJson}
              onChange={(e) => setCategoriesJson(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
        {saved && <span className="text-sm font-medium text-green-600">Αποθηκεύτηκε</span>}
      </div>
    </form>
  );
}
