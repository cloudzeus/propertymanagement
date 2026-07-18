import { EmptyState } from "@/components/dashboard";
import { RiFolderLine, RiFileImageLine, RiFilePdf2Line, RiFileTextLine, RiDownload2Line } from "react-icons/ri";

export type FileListFile = {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type FileListGroup = { building: string; files: FileListFile[] };

function fileIcon(mimeType: string | null) {
  if (mimeType?.startsWith("image/")) return RiFileImageLine;
  if (mimeType === "application/pdf") return RiFilePdf2Line;
  return RiFileTextLine;
}
function fmtSize(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Shared building-files UI for owner + resident portals: one card per building
 * grouping its files, each a download row with icon-by-mimetype + size.
 */
export function FilesList({
  groups, emptyLabel = "Δεν υπάρχουν διαθέσιμα αρχεία.",
}: { groups: FileListGroup[]; emptyLabel?: string }) {
  if (groups.length === 0) {
    return <EmptyState icon={RiFolderLine} label={emptyLabel} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {groups.map((g) => (
        <div key={g.building} style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card)", padding: 20,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)",
            textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8,
          }}>
            {g.building}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {g.files.map((f) => {
              const Icon = fileIcon(f.mimeType);
              return (
                <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  background: "var(--bg-canvas)", borderRadius: 8, textDecoration: "none",
                }}>
                  <Icon style={{ fontSize: 16, color: "var(--muted-foreground)", flexShrink: 0 }} />
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: "var(--foreground)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {f.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{fmtSize(f.sizeBytes)}</span>
                  <RiDownload2Line style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
