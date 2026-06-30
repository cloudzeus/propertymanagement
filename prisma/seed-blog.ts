import { db } from "@/lib/db";

async function main() {
  // 1. PageSeo — blog slug (create-only on conflict to avoid clobbering admin edits)
  await db.pageSeo.upsert({
    where: { slug: "blog" },
    update: {},
    create: {
      slug: "blog",
      seo: {
        el: { title: "Blog — PropertyPro", description: "Νέα, οδηγοί και ενημερώσεις για τη διαχείριση ακινήτων.", ogImage: "" },
        en: { title: "Blog — PropertyPro", description: "News, guides and updates on property management.", ogImage: "" },
      },
    },
  });
  console.log("PageSeo: upserted slug 'blog'.");

  // 2. Author — create-only on conflict
  const author = await db.author.upsert({
    where: { slug: "omada-propertypro" },
    update: {},
    create: {
      name: "Ομάδα PropertyPro",
      slug: "omada-propertypro",
      bio: { el: "Η ομάδα της PropertyPro.", en: "The PropertyPro team." },
    },
  });
  console.log(`Author: upserted '${author.slug}' (id=${author.id}).`);

  // 3. Article — create-only on conflict
  await db.article.upsert({
    where: { slug: "kalwsorisate" },
    update: {},
    create: {
      slug: "kalwsorisate",
      authorId: author.id,
      i18n: {
        title:   { el: "Καλώς ήρθατε στο PropertyPro Blog",  en: "Welcome to the PropertyPro Blog" },
        excerpt: {
          el: "Ξεκινάμε ένα blog με νέα, οδηγούς και συμβουλές για τη διαχείριση πολυκατοικιών και ακινήτων.",
          en: "We are starting a blog with news, guides and tips for managing buildings and properties.",
        },
        body: {
          el: "## Καλώς ήρθατε\n\nΣε αυτό το blog θα μοιραζόμαστε **νέα**, οδηγούς και πρακτικές συμβουλές για διαχειριστές, ιδιοκτήτες και ενοίκους.\n\n- Ενημερώσεις προϊόντος\n- Οδηγοί κοινοχρήστων\n- Καλές πρακτικές\n\nΜείνετε συντονισμένοι!",
          en: "## Welcome\n\nOn this blog we will share **news**, guides and practical tips for property managers, owners and residents.\n\n- Product updates\n- Shared-expenses guides\n- Best practices\n\nStay tuned!",
        },
      },
      status: "PUBLISHED",
      publishedAt: new Date(),
      tags: ["νέα", "propertypro"],
      galleryMediaIds: [],
    },
  });
  console.log("Article: upserted slug 'kalwsorisate'.");

  console.log("seed-blog complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
