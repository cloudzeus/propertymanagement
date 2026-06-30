export type MediaType = "IMAGE" | "SVG" | "VIDEO" | "OTHER";
export function detectMediaType(mime: string, name: string): MediaType {
  const n = (name || "").toLowerCase();
  if (mime === "image/svg+xml" || n.endsWith(".svg")) return "SVG";
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  return "OTHER";
}
