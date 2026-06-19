import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const AADE_ENDPOINT = "https://vat.wwa.gr/afm2info";

type FirmAct = {
  firm_act_code?: string;
  firm_act_descr?: string;
  firm_act_kind?: string;
  firm_act_kind_descr?: string;
};

type BasicRec = {
  afm?: string;
  doy_descr?: string;
  deactivation_flag_descr?: string;
  onomasia?: string;
  commer_title?: string;
  legal_status_descr?: string;
  postal_address?: string;
  postal_address_no?: string;
  postal_zip_code?: string;
  postal_area_description?: string;
  regist_date?: string;
  normal_vat_system_flag?: string;
};

type AadeResponse = {
  basic_rec?: BasicRec;
  firm_act_tab?: { item?: FirmAct | FirmAct[] };
  error?: { rg_error_code?: string; rg_error_descr?: string };
};

// Map ΑΑΔΕ legal status to our LEGAL_FORMS list values.
const LEGAL_FORM_MAP: Record<string, string> = {
  ΑΕ: "ΑΕ", ΕΠΕ: "ΕΠΕ", ΙΚΕ: "ΙΚΕ", ΟΕ: "ΟΕ", ΕΕ: "ΕΕ",
  ΑΤΟΜΙΚΗ: "ΑΤΟΜΙΚΗ", ΚΟΙΝΟΠΡΑΞΙΑ: "ΚΟΙΝΟΠΡΑΞΙΑ",
};

function mapLegalForm(descr?: string): string {
  if (!descr) return "";
  const up = descr.toUpperCase().trim();
  for (const key of Object.keys(LEGAL_FORM_MAP)) {
    if (up.includes(key)) return LEGAL_FORM_MAP[key];
  }
  return "ΑΛΛΟ";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { afm } = (await req.json().catch(() => ({}))) as { afm?: string };
  const cleanAfm = (afm ?? "").replace(/\D/g, "");
  if (cleanAfm.length !== 9) {
    return NextResponse.json({ error: "Μη έγκυρο ΑΦΜ (απαιτούνται 9 ψηφία)" }, { status: 400 });
  }

  let aade: AadeResponse;
  try {
    const res = await fetch(AADE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ afm: cleanAfm }),
      cache: "no-store",
    });
    aade = (await res.json()) as AadeResponse;
  } catch {
    return NextResponse.json({ error: "Σφάλμα επικοινωνίας με την υπηρεσία ΑΑΔΕ" }, { status: 502 });
  }

  if (aade.error?.rg_error_descr) {
    return NextResponse.json({ error: aade.error.rg_error_descr }, { status: 404 });
  }

  const b = aade.basic_rec;
  if (!b) {
    return NextResponse.json({ error: "Δεν βρέθηκαν στοιχεία για το ΑΦΜ" }, { status: 404 });
  }

  const acts = Array.isArray(aade.firm_act_tab?.item)
    ? (aade.firm_act_tab!.item as FirmAct[])
    : aade.firm_act_tab?.item
      ? [aade.firm_act_tab.item as FirmAct]
      : [];
  const primary = acts.find((a) => a.firm_act_kind === "1") ?? acts[0];

  const address = [b.postal_address, b.postal_address_no].filter(Boolean).join(" ").trim();
  const foundedAt = b.regist_date && /^\d{4}-\d{2}-\d{2}$/.test(b.regist_date) ? b.regist_date : "";

  // Map ΑΑΔΕ fields onto our company-profile form keys.
  const mapped: Record<string, string> = {
    afm: b.afm ?? cleanAfm,
    name: b.onomasia ?? "",
    legalName: b.commer_title ?? "",
    legalForm: mapLegalForm(b.legal_status_descr),
    taxOffice: b.doy_descr ?? "",
    activity: primary?.firm_act_descr ?? "",
    kadCode: primary?.firm_act_code ?? "",
    vatStatus: b.normal_vat_system_flag === "Y" ? "Κανονικό" : "",
    address,
    city: b.postal_area_description ?? "",
    postalCode: b.postal_zip_code ?? "",
    country: "Ελλάδα",
    foundedAt,
  };

  return NextResponse.json({ data: mapped, raw: b });
}
