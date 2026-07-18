import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { PUBLIC_FILE_CATEGORIES } from "@/lib/dashboard/owner-queries";
import { FilesList, type FileListGroup } from "@/components/dashboard/files-list";

export const metadata = { title: "Αρχεία" };

export default async function PortalFilesPage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;

  const units = await db.unit.findMany({
    where: {
      OR: [
        { residentId: userId },
        { occupancies: { some: { userId, endDate: null } } },
      ],
    },
    select: { buildingId: true },
  });
  const buildingIds = [...new Set(units.map((u) => u.buildingId))];

  const files = await db.buildingFile.findMany({
    where: { buildingId: { in: buildingIds }, category: { in: [...PUBLIC_FILE_CATEGORIES] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, url: true, mimeType: true, sizeBytes: true, building: { select: { name: true } } },
  });

  const filesByBuilding = new Map<string, FileListGroup>();
  for (const f of files) {
    const key = f.building.name;
    const g = filesByBuilding.get(key) ?? { building: key, files: [] };
    g.files.push(f);
    filesByBuilding.set(key, g);
  }
  const groups = [...filesByBuilding.values()];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Αρχεία</h1>
      <FilesList groups={groups} />
    </div>
  );
}
