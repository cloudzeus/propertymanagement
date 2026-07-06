import { requirePermission } from "@/lib/rbac/permissions";
import { listAuthors } from "@/lib/cms/blog";
import { AuthorsClient } from "./AuthorsClient";

export default async function AuthorsPage() {
  await requirePermission("cms-authors", "view");
  const authors = await listAuthors();
  return <AuthorsClient initial={JSON.parse(JSON.stringify(authors))} />;
}
