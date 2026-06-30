import { listAuthors } from "@/lib/cms/blog";
import { AuthorsClient } from "./AuthorsClient";

export default async function AuthorsPage() {
  const authors = await listAuthors();
  return <AuthorsClient initial={JSON.parse(JSON.stringify(authors))} />;
}
