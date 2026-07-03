import type { IconType } from "react-icons";

export function EmptyState({ icon: Icon, label }: { icon: IconType; label: string }) {
  return (
    <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
      <Icon style={{ fontSize: 30, opacity: 0.35, display: "block", margin: "0 auto 8px" }} />
      {label}
    </div>
  );
}
