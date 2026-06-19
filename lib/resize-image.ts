// Client-side image normalisation: resize so the longest side is ≤ maxPx and
// re-encode to WebP before upload. Non-images (e.g. video, pdf) pass through
// unchanged. Runs in the browser only (uses canvas / createImageBitmap).

export async function toWebpResized(file: File, maxPx = 1920, quality = 0.85): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  // Skip formats canvas can't reliably decode (e.g. svg) — upload as-is.
  if (file.type === "image/svg+xml") return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const scale = Math.min(1, maxPx / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/webp", quality));
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file; // on any failure, fall back to the original file
  }
}
