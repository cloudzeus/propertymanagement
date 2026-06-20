"use server";

import sharp from "sharp";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { uploadFile, deleteFile } from "@/lib/bunnycdn";
import { revalidatePath } from "next/cache";

// The four logo slots -> their AppSettings column.
const SLOTS = {
  logoFullLight: "logoFullLight",
  logoFullDark: "logoFullDark",
  logoSquareLight: "logoSquareLight",
  logoSquareDark: "logoSquareDark",
} as const;

type Slot = keyof typeof SLOTS;

async function requireSuperAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role !== "SUPER_ADMIN") throw new Error("Forbidden");
  return session.user.id as string;
}

function cdnPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}

/**
 * Upload one brand logo slot. SVG is stored as-is; everything else is converted
 * to WebP with transparency preserved. Replaces (and deletes) any previous file
 * in that slot.
 * Expects FormData: slot (one of the four), file.
 */
export async function uploadBrandLogo(formData: FormData) {
  const userId = await requireSuperAdmin();

  const slot = String(formData.get("slot") || "") as Slot;
  if (!(slot in SLOTS)) return { error: "Μη έγκυρο slot" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Λείπει αρχείο" };

  const input = Buffer.from(await file.arrayBuffer());
  const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

  let buffer: Buffer;
  let ext: string;
  let contentType: string;
  if (isSvg) {
    buffer = input;
    ext = "svg";
    contentType = "image/svg+xml";
  } else {
    buffer = await sharp(input).webp({ quality: 90 }).toBuffer(); // alpha preserved by default
    ext = "webp";
    contentType = "image/webp";
  }

  const path = `brand/${slot}-${Date.now()}.${ext}`;
  const res = await uploadFile({ path, buffer, contentType });
  if (!res.success || !res.url) return { error: res.error || "Αποτυχία ανεβάσματος" };

  // Delete the previous object for this slot (best-effort).
  const current = await db.appSettings.findUnique({ where: { id: "singleton" }, select: { [slot]: true } as any });
  const oldPath = cdnPathFromUrl((current as any)?.[slot]);
  if (oldPath && oldPath !== path) await deleteFile(oldPath);

  await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", [slot]: res.url, updatedById: userId } as any,
    update: { [slot]: res.url, updatedById: userId } as any,
  });

  revalidatePath("/", "layout");
  return { url: res.url, slot };
}

/** Remove a brand logo slot (clears the field + deletes the CDN object). */
export async function removeBrandLogo(slot: Slot) {
  const userId = await requireSuperAdmin();
  if (!(slot in SLOTS)) return { error: "Μη έγκυρο slot" };

  const current = await db.appSettings.findUnique({ where: { id: "singleton" }, select: { [slot]: true } as any });
  const oldPath = cdnPathFromUrl((current as any)?.[slot]);
  if (oldPath) await deleteFile(oldPath);

  await db.appSettings.update({
    where: { id: "singleton" },
    data: { [slot]: null, updatedById: userId } as any,
  });

  revalidatePath("/", "layout");
  return { ok: true, slot };
}
