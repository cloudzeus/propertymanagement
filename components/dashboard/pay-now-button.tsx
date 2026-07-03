import { RiBankCardLine } from "react-icons/ri";
import { formatEuro } from "@/lib/dashboard/aggregations";

export function PayNowButton({ amount, href = "/portal/payments" }: { amount: number; href?: string }) {
  return (
    <a href={href} style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px",
      borderRadius: 999, background: "var(--color-primary)", color: "#fff",
      fontSize: 14, fontWeight: 600, textDecoration: "none", boxShadow: "var(--shadow-btn)",
    }}>
      <RiBankCardLine style={{ fontSize: 18 }} /> Πληρωμή τώρα · {formatEuro(amount)}
    </a>
  );
}
