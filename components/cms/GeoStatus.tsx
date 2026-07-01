import Link from "next/link";
import { RiCheckboxCircleFill, RiCloseCircleLine, RiMapPin2Line } from "react-icons/ri";
import { CmsCard } from "@/components/cms/ui";

type Field = { label: string; ok: boolean };

export function GeoStatus({ fields }: { fields: Field[] }) {
  return (
    <CmsCard title="GEO — LocalBusiness">
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 0 }}>
        <RiMapPin2Line style={{ verticalAlign: "-2px" }} /> Το τοπικό schema εμφανίζεται σε όλες τις σελίδες από τις Ρυθμίσεις.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {fields.map((f) => (
          <span key={f.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: f.ok ? "var(--color-success)" : "var(--muted-foreground)" }}>
            {f.ok ? <RiCheckboxCircleFill size={15} /> : <RiCloseCircleLine size={15} />} {f.label}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Link href="/super-admin/cms/settings" style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
          Επεξεργασία GEO στις Ρυθμίσεις →
        </Link>
      </div>
    </CmsCard>
  );
}
