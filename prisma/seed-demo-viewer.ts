/**
 * Seed a demo PROPERTY_VIEWER account wired to the first managed building, so the
 * /signage surface has a real viewer to View-as into (idempotent — matches by email).
 *
 * The account has NO password (passwordHash left null) — direct credentials login is
 * rejected (see auth.ts: `if (!user || !user.passwordHash) return null;`). It's only
 * reachable via super-admin View-as impersonation, which doesn't need a password.
 *
 * Run: npx tsx --env-file=.env prisma/seed-demo-viewer.ts
 */
import { db } from "../lib/db";

const DEMO_ANNOUNCEMENT_TITLE = "Καλώς ήρθατε";

async function main() {
  const email = "signage-demo@dgsmart.gr";

  const building = await db.building.findFirst({
    where: { property: { managed: true } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, companyId: true, property: { select: { customerId: true } } },
  });
  if (!building) {
    console.log("No managed building found — aborting.");
    return;
  }

  const existing = await db.user.findUnique({ where: { email } });
  const user = existing ?? await db.user.create({
    data: {
      email,
      name: "Οθόνη Εισόδου (Demo)",
      role: "PROPERTY_VIEWER",
      status: "ACTIVE",
      companyId: building.companyId,
      customerId: building.property.customerId,
    },
  });

  const has = await db.managementAssignment.findFirst({ where: { userId: user.id, buildingId: building.id } });
  if (!has) {
    await db.managementAssignment.create({
      data: { userId: user.id, buildingId: building.id, role: "PROPERTY_VIEWER" },
    });
  }

  // The building had zero ACTIVE audience-ALL announcements, which would make the
  // /signage board render empty. Seed one demo announcement (idempotent by title+buildingId).
  const hasDemoAnnouncement = await db.announcement.findFirst({
    where: { buildingId: building.id, title: DEMO_ANNOUNCEMENT_TITLE },
  });
  if (!hasDemoAnnouncement) {
    await db.announcement.create({
      data: {
        buildingId: building.id,
        title: DEMO_ANNOUNCEMENT_TITLE,
        content: "<p>Η οθόνη του κτηρίου ενημερώνεται αυτόματα από τη διαχείριση.</p>",
        status: "ACTIVE",
        audience: "ALL",
        origin: "STAFF",
        publishedAt: new Date(),
      },
    });
    console.log(`Created demo announcement "${DEMO_ANNOUNCEMENT_TITLE}" on ${building.name}`);
  }

  console.log(`Viewer ${email} → ${building.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
