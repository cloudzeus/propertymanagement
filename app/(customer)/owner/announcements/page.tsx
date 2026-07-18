import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getOwnerAnnouncementsAndFiles } from "@/lib/dashboard/owner-queries";
import { SectionCard, EmptyState } from "@/components/dashboard";
import { FilesList, type FileListGroup } from "@/components/dashboard/files-list";
import { RiNotification2Line } from "react-icons/ri";

export const metadata = { title: "Ανακοινώσεις" };

const fmtDate = (d: Date) => d.toLocaleDateString("el-GR", { day: "2-digit", month: "long", year: "numeric" });

export default async function OwnerAnnouncementsPage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;

  const { announcements, files } = await getOwnerAnnouncementsAndFiles(userId);

  const filesByBuilding = new Map<string, FileListGroup>();
  for (const f of files) {
    const key = f.building.name;
    const g = filesByBuilding.get(key) ?? { building: key, files: [] };
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
        <FilesList groups={fileGroups} />
      </SectionCard>
    </div>
  );
}
