import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { uploadFile } from "@/lib/bunnycdn";
import { detectMediaType } from "@/lib/cms/media-types";

function rid() { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }

export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: "Λείπει αρχείο" }, { status: 400 });

  const type = detectMediaType(file.type, file.name);
  if (type === "OTHER") return NextResponse.json({ error: "Μη υποστηριζόμενος τύπος αρχείου" }, { status: 400 });

  const input = Buffer.from(await file.arrayBuffer());
  let buffer: Buffer = input, ext = "bin", contentType = file.type || "application/octet-stream";
  let width: number | null = null, height: number | null = null;

  if (type === "IMAGE") {
    const out = await sharp(input).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    buffer = out.data; ext = "webp"; contentType = "image/webp"; width = out.info.width; height = out.info.height;
  } else if (type === "SVG") {
    ext = "svg"; contentType = "image/svg+xml";
  } else {
    ext = (file.name.split(".").pop() || "mp4").toLowerCase(); contentType = file.type || "video/mp4";
  }

  const id = rid();
  const path = `media/${id}.${ext}`;
  const res = await uploadFile({ path, buffer, contentType });
  if (!res.success || !res.url) return NextResponse.json({ error: res.error || "Αποτυχία ανεβάσματος" }, { status: 500 });

  const asset = await db.mediaAsset.create({
    data: {
      id, type, url: res.url, cdnPath: path, mime: contentType, width, height,
      sizeBytes: buffer.length, originalName: file.name,
      alt: String(form.get("alt") || "") || null, title: String(form.get("title") || "") || null,
      createdById: (session!.user as any).id ?? null,
    },
  });
  return NextResponse.json({ asset });
}
