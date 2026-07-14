import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/auth";
import { uploadFile } from "@/lib/bunnycdn";

export const maxDuration = 60;

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function rid() { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }

/** Upload φωτογραφίας/βίντεο για δήλωση βλάβης. Επιστρέφει descriptor για το createMaintenanceRequest. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: "Λείπει αρχείο" }, { status: 400 });

  const mime = file.type || "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  if (!isImage && !isVideo) return NextResponse.json({ error: "Επιτρέπονται μόνο φωτογραφίες και βίντεο" }, { status: 400 });
  if (isVideo && file.size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "Το βίντεο ξεπερνά τα 100MB" }, { status: 400 });
  if (isImage && file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Η φωτογραφία ξεπερνά τα 25MB" }, { status: 400 });

  const input = Buffer.from(await file.arrayBuffer());
  let buffer: Buffer = input;
  let ext: string;
  let contentType = mime;

  if (isImage && mime !== "image/svg+xml") {
    const out = await sharp(input).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    buffer = out; ext = "webp"; contentType = "image/webp";
  } else if (isImage) {
    ext = "svg";
  } else {
    ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  }

  const path = `maintenance/${rid()}.${ext}`;
  const res = await uploadFile({ path, buffer, contentType });
  if (!res.success || !res.url) return NextResponse.json({ error: res.error || "Αποτυχία ανεβάσματος" }, { status: 500 });

  return NextResponse.json({
    attachment: {
      url: res.url,
      cdnPath: path,
      kind: isVideo ? "VIDEO" : "IMAGE",
      contentType,
      sizeBytes: buffer.length,
    },
  });
}
