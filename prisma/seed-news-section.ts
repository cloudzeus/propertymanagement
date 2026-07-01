import { db } from "../lib/db";

async function main() {
  const existing = await db.landingSection.findUnique({ where: { type: "NEWS" } });
  if (existing) {
    console.log("NEWS section exists");
    return;
  }
  const max = await db.landingSection.aggregate({ _max: { order: true } });
  await db.landingSection.create({
    data: {
      type: "NEWS",
      enabled: false,
      order: (max._max.order ?? 0) + 1,
      data: {
        el: { heading: "Νέα & άρθρα", intro: "", count: 3 },
        en: { heading: "News & articles", intro: "", count: 3 },
      },
    },
  });
  console.log("Seeded NEWS section");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
