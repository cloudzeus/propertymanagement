import { requirePermission } from "@/lib/rbac/permissions";
import { listMedia } from "@/lib/cms/media";
import { MediaClient } from "./MediaClient";

export default async function MediaCmsPage() {
  await requirePermission("cms-media", "view");
  const items = await listMedia();
  return <MediaClient initial={JSON.parse(JSON.stringify(items))} />;
}
