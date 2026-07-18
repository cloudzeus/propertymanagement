import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getOwnerAnnouncementsAndFiles } from "@/lib/dashboard/owner-queries";
import { SectionCard, EmptyState } from "@/components/dashboard";
import {
  RiNotification2Line, RiFolderLine, RiFileImageLine, RiFilePdf2Line, RiFileTextLine, RiDownload2Line,
} from "react-icons/ri";

export const metadata = { title: "Ανακοινώσεις" };

const fmtDate = (d: Date) => d.toLocaleDateString("el-GR", { day: "2-digit", month: "long", year: "numeric" });

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

export default async function OwnerAnnouncementsPage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;

  const { announcements, files } = await getOwnerAnnouncementsAndFiles(userId);

  const filesByBuilding = new Map<string, { name: string; files: typeof files }>();
  for (const f of files) {
    const key = f.building.name;
    const g = filesByBuilding.get(key) ?? { name: key, files: [] };
    g.files.push(f);
    filesByBuilding.set(key, g);
  }
  const fileGroups = [...filesByBuilding.values()];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Ανακοινώσεις</h1>

      {announcements.length === 0 ? (
        <EmptyState icon={RiNotification2Line} label="Δεν υπάρχουν ενεργές ανακοινώσεις." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {announcements.map((a) => (
            <div key={a.id} style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-card)", padding: 20,
            }}>
              {a.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.imageUrl} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10, marginBottom: 14 }} />
              )}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{a.title}</h2>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                  {a.building?.name ?? "Όλα τα κτήρια"} · {fmtDate(a.createdAt)}
                </span>
              </div>
              <div
                style={{ fontSize: 13, lineHeight: 1.6, color: "var(--foreground)", maxHeight: 400, overflow: "hidden" }}
                dangerouslySetInnerHTML={{ __html: a.content }}
              />
            </div>
          ))}
        </div>
      )}

      <SectionCard title="Αρχεία κτηρίων">
        {fileGroups.length === 0 ? (
          <EmptyState icon={RiFolderLine} label="Δεν υπάρχουν διαθέσιμα αρχεία." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {fileGroups.map((g) => (
              <div key={g.name}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)",
                  textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8,
                }}>
                  {g.name}
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
        )}
      </SectionCard>
    </div>
  );
}
