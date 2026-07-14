import { RiShieldCheckLine, RiUserSettingsLine } from "react-icons/ri";

/** Εμφανής ένδειξη αν η ιδιοκτησία/κτήριο διαχειρίζεται από την εταιρία (managed) ή είναι αυτοδιαχείριστη. */
export function ManagedBadge({ managed, size = "md" }: { managed: boolean; size?: "sm" | "md" }) {
  const color = managed ? "#15803d" : "#6b7280";
  const label = managed ? "Managed" : "Αυτοδιαχείριση";
  const Icon = managed ? RiShieldCheckLine : RiUserSettingsLine;
  const sm = size === "sm";
  return (
    <span
      title={managed ? "Διαχειρίζεται από την εταιρεία (managed συμβόλαιο)" : "Αυτοδιαχείριστη ιδιοκτησία — υπεύθυνος ο διαχειριστής"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: sm ? "1px 8px" : "3px 10px", borderRadius: 999,
        fontSize: sm ? 11 : 12, fontWeight: 700, whiteSpace: "nowrap",
        color, background: `${color}15`, border: `1px solid ${color}40`,
      }}
    >
      <Icon style={{ fontSize: sm ? 12 : 14 }} /> {label}
    </span>
  );
}
