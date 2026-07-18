import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { homePathForRole } from "@/lib/surfaces";
import { viewerBuildingIds, getSignageData, getWeather } from "@/lib/signage/data";
import { SignageBoard } from "@/components/signage/SignageBoard";
import type { UserRole } from "@/lib/prisma/enums";

export const metadata = { title: "Πίνακας κτηρίου" };

const STAFF: UserRole[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];

export default async function SignagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const role = eff.user.role;
  const userId = eff.user.id;

  const requested = typeof sp.building === "string" ? sp.building : null;
  let buildingId: string | null = null;
  if (STAFF.includes(role)) {
    // Staff preview must name a building explicitly (?building=<id>).
    buildingId = requested;
    if (!buildingId) redirect(homePathForRole(role));
  } else if (role === "PROPERTY_VIEWER") {
    const ids = await viewerBuildingIds(userId);
    buildingId = requested && ids.includes(requested) ? requested : ids[0] ?? null;
  } else {
    redirect(homePathForRole(role));
  }

  const data = buildingId ? await getSignageData(buildingId) : null;
  if (!data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          opacity: 0.7,
        }}
      >
        Δεν έχει οριστεί κτήριο για αυτή την οθόνη.
      </div>
    );
  }
  const weather = await getWeather(data.building.lat, data.building.lng);
  return <SignageBoard data={data} weather={weather} />;
}
