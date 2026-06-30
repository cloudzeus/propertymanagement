import { db } from "@/lib/db";
import { createPricingTier } from "@/app/actions/pages-cms";
import { PricingTierEditor } from "./PricingTierEditor";

async function addTier() {
  "use server";
  const slug = `tier-${Date.now()}`;
  await createPricingTier({
    name: "Νέο πλάνο",
    slug,
    description: "",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [],
    highlighted: false,
    order: 0,
    published: false,
    i18n: {
      name: { el: "Νέο πλάνο", en: "" },
      description: { el: "", en: "" },
      features: { el: [], en: [] },
    },
  });
}

export default async function PricingCmsPage() {
  const tiers = await db.pricingTier.findMany({ orderBy: { order: "asc" } });

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">CMS — Πλάνα τιμολόγησης</h1>
        <form action={addTier}>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Νέο πλάνο
          </button>
        </form>
      </div>

      {tiers.length === 0 && (
        <p className="text-sm text-slate-500">Δεν υπάρχουν πλάνα ακόμη.</p>
      )}

      <div className="space-y-4">
        {tiers.map((t) => (
          <PricingTierEditor key={t.id} tier={t as any} />
        ))}
      </div>
    </div>
  );
}
