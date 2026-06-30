import { listMedia } from "@/lib/cms/media";
import { MediaClient } from "./MediaClient";

export default async function MediaCmsPage() {
  const items = await listMedia();
  return <MediaClient initial={JSON.parse(JSON.stringify(items))} />;
}
