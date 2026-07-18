import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { homePathForRole } from "@/lib/surfaces";
import { viewerBuildingIds, getSignageData, getWeather } from "@/lib/signage/data";
import { SignageBoard } from "@/components/signage/SignageBoard";
import { stopImpersonation } from "@/app/actions/impersonation";
import type { UserRole } from "@/lib/prisma/enums";

export const metadata = { title: "Πίνακας κτηρίου" };

const STAFF: UserRole[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];

/** Escape hatch for super-admin View-as on the fullscreen board (which hides the
 *  cursor and has no chrome) — invisible for real viewer sessions. */
function ImpersonationEscape() {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 14px", fontSize: 13, background: "#5b5c58", color: "#fff",
      cursor: "default",
    }}>
      <span>Προβολή ως θεατής</span>
      <form action={stopImpersonation}>
        <button type="submit" style={{
          background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.35)",
          color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 999,
          cursor: "pointer",
        }}>Έξοδος</button>
      </form>
    </div>
  );
}

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

  const escape = eff.impersonatorId ? <ImpersonationEscape /> : null;
  const data = buildingId ? await getSignageData(buildingId) : null;
  if (!data) {
    return (
      <>
        {escape}
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
      </>
    );
  }
  const weather = await getWeather(data.building.lat, data.building.lng);
  return (
    <>
      {escape}
      <SignageBoard data={data} weather={weather} />
    </>
  );
}
