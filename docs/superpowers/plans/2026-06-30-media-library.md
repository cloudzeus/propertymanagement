# Media Library — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** A shared CMS media library: upload (images → WebP max-1920 with alpha; SVG/video pass-through) to Bunny CDN, browse/search/delete, and a reusable `<MediaPicker/>`.

**Architecture:** `MediaAsset` Prisma model. Uploads via a SUPER_ADMIN-guarded Route Handler (`/api/cms/media/upload`) that runs sharp for images and `lib/bunnycdn.ts` for storage. A gallery page + `MediaPicker` modal built on the CMS UI kit. Delete/meta via server actions.

**Tech Stack:** Next.js 16.2 Route Handler, Prisma 7 (diff+deploy; DB scripts `npx tsx --env-file=.env`), `sharp` ^0.35.2, `lib/bunnycdn.ts` (`uploadFile`/`deleteFile`), CMS UI kit (`components/cms/ui.tsx`), `components/ui/{data-table,modal}.tsx`, Vitest.

**Verified facts:**
- `lib/bunnycdn.ts`: `uploadFile({path,buffer,contentType}) → {success,url,error}` (url=`${BUNNY_CDN_URL}/${path}`); `deleteFile(path) → {success}`.
- `app/actions/brand.ts` pattern: `const isSvg = file.type==="image/svg+xml" || name.endsWith(".svg")`; image → `sharp(input).webp({quality:90}).toBuffer()`; `requireSuperAdmin()` via `auth()` role check; `cdnPathFromUrl(url)` strips origin.
- CMS UI kit exports CmsPage/CmsCard/CmsField/CmsInput/CmsTextarea/LocaleTabs/CmsButton/SaveBar. CMS menu group "cms" in `components/admin/sidebar-nav.tsx`.
- `/api/*` is EXCLUDED from `proxy.ts` matcher → API routes must self-guard auth.

---

## File Structure
**New:** `lib/cms/media-types.ts` (+ test), `lib/cms/media.ts`, `app/api/cms/media/upload/route.ts`, `app/actions/media.ts`, `app/(company)/super-admin/cms/media/page.tsx` + `MediaClient.tsx`, `components/cms/MediaPicker.tsx`.
**Modified:** `prisma/schema.prisma`, `components/admin/sidebar-nav.tsx`.

---

## Task 1: MediaAsset model + media-type helper (TDD) + accessor

**Files:** Modify `prisma/schema.prisma`; create `lib/cms/media-types.ts` (+ `.test.ts`), `lib/cms/media.ts`.

- [ ] **Step 1:** Add model:
```prisma
model MediaAsset {
  id           String   @id @default(cuid())
  type         String
  url          String
  cdnPath      String
  mime         String
  width        Int?
  height       Int?
  sizeBytes    Int?
  alt          String?
  title        String?
  originalName String?
  createdById  String?
  createdAt    DateTime @default(now())
  @@index([type])
  @@index([createdAt])
}
```
`npx prisma generate`; migration via `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script` → `prisma/migrations/20260630060000_add_media_asset/migration.sql`; `npx prisma migrate deploy` (if DB down, DONE_WITH_CONCERNS).
- [ ] **Step 2: TDD** `lib/cms/media-types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { detectMediaType } from "./media-types";
describe("detectMediaType", () => {
  it("svg by mime or extension", () => {
    expect(detectMediaType("image/svg+xml", "x.png")).toBe("SVG");
    expect(detectMediaType("application/octet-stream", "logo.SVG")).toBe("SVG");
  });
  it("image", () => { expect(detectMediaType("image/png", "x.png")).toBe("IMAGE"); });
  it("video", () => { expect(detectMediaType("video/mp4", "x.mp4")).toBe("VIDEO"); });
  it("unknown image-ish falls back to IMAGE only for image/*", () => {
    expect(detectMediaType("application/pdf", "x.pdf")).toBe("OTHER");
  });
});
```
Run → fail.
- [ ] **Step 3:** `lib/cms/media-types.ts`:
```ts
export type MediaType = "IMAGE" | "SVG" | "VIDEO" | "OTHER";
export function detectMediaType(mime: string, name: string): MediaType {
  const n = (name || "").toLowerCase();
  if (mime === "image/svg+xml" || n.endsWith(".svg")) return "SVG";
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  return "OTHER";
}
```
Run → pass.
- [ ] **Step 4:** `lib/cms/media.ts`:
```ts
import "server-only";
import { db } from "@/lib/db";
export async function listMedia(opts?: { type?: string; q?: string }) {
  return db.mediaAsset.findMany({
    where: {
      ...(opts?.type ? { type: opts.type } : {}),
      ...(opts?.q ? { OR: [{ title: { contains: opts.q, mode: "insensitive" } }, { alt: { contains: opts.q, mode: "insensitive" } }, { originalName: { contains: opts.q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}
export async function getMediaByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.mediaAsset.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
```
- [ ] **Step 5:** `npx tsc --noEmit | grep -i "cms/media" || echo ok`; `npm run test -- lib/cms/media-types.test.ts`. Commit `git add prisma/schema.prisma prisma/migrations/ lib/prisma lib/cms/media-types.ts lib/cms/media-types.test.ts lib/cms/media.ts && git commit -m "feat(media): MediaAsset model + type helper + accessors"`.

---

## Task 2: Upload Route Handler + delete/meta actions

**Files:** Create `app/api/cms/media/upload/route.ts`, `app/actions/media.ts`.

- [ ] **Step 1:** `app/api/cms/media/upload/route.ts` (read `app/actions/brand.ts` first for the exact sharp/upload calls):
```ts
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
  let buffer = input, ext = "bin", contentType = file.type || "application/octet-stream";
  let width: number | null = null, height: number | null = null;

  if (type === "IMAGE") {
    const out = await sharp(input).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    buffer = out.data; ext = "webp"; contentType = "image/webp"; width = out.info.width; height = out.info.height;
  } else if (type === "SVG") {
    ext = "svg"; contentType = "image/svg+xml";
  } else { // VIDEO — pass-through
    ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    contentType = file.type || "video/mp4";
  }

  const id = rid();
  const path = `media/${id}.${ext}`;
  const res = await uploadFile({ path, buffer, contentType });
  if (!res.success || !res.url) return NextResponse.json({ error: res.error || "Αποτυχία ανεβάσματος" }, { status: 500 });

  const asset = await db.mediaAsset.create({
    data: { id, type, url: res.url, cdnPath: path, mime: contentType, width, height, sizeBytes: buffer.length, originalName: file.name, alt: String(form.get("alt") || "") || null, title: String(form.get("title") || "") || null, createdById: (session!.user as any).id ?? null },
  });
  return NextResponse.json({ asset });
}
```
- [ ] **Step 2:** `app/actions/media.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/bunnycdn";
async function requireSuperAdmin() { const s = await auth(); if ((s?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden"); }
export async function deleteMedia(id: string): Promise<void> {
  await requireSuperAdmin();
  const row = await db.mediaAsset.findUnique({ where: { id } });
  if (!row) return;
  try { await deleteFile(row.cdnPath); } catch { /* best-effort */ }
  await db.mediaAsset.delete({ where: { id } });
  revalidatePath("/super-admin/cms/media");
}
export async function updateMediaMeta(id: string, data: { alt?: string; title?: string }): Promise<void> {
  await requireSuperAdmin();
  await db.mediaAsset.update({ where: { id }, data: { alt: data.alt ?? null, title: data.title ?? null } });
  revalidatePath("/super-admin/cms/media");
}
```
- [ ] **Step 3:** `npx tsc --noEmit | grep -iE "media/upload|actions/media" || echo ok`; `npm run build`. Commit `git add app/api/cms/media app/actions/media.ts && git commit -m "feat(media): upload route (webp/1920, svg/video passthrough) + delete/meta actions"`.

---

## Task 3: Media gallery page + UI + menu

**Files:** Create `app/(company)/super-admin/cms/media/page.tsx`, `MediaClient.tsx`; modify `components/admin/sidebar-nav.tsx`.

- [ ] **Step 1:** `page.tsx` (server): `const items = await listMedia();` → `<MediaClient initial={JSON.parse(JSON.stringify(items))} />`.
- [ ] **Step 2:** `MediaClient.tsx` ('use client'): `<CmsPage icon={<RiImage2Line/>} title="Media" subtitle="Βιβλιοθήκη πολυμέσων">`. Toolbar: a hidden `<input type="file" multiple>` + an "Ανέβασμα" CmsButton triggering it; on change, for each file `fetch("/api/cms/media/upload",{method:"POST",body:FormData})`, show progress, then `router.refresh()`. A search CmsInput (filters client-side by title/alt/originalName) + a type filter (All/IMAGE/SVG/VIDEO). A responsive grid (`repeat(auto-fill,minmax(180px,1fr))`, gap 12) of cards: preview — IMAGE/SVG → `<img src={url}>` (object-fit cover, checkered bg for transparency), VIDEO → `<video src={url} muted>` or a film icon + filename; below: title/originalName (truncated), `${width}×${height}` + type badge. Click a card → a Modal showing the full preview + editable alt/title (CmsField/CmsInput, save → `updateMediaMeta`) + Διαγραφή (danger → `deleteMedia` + refresh, confirm) + a "Αντιγραφή URL" button. Use the CMS kit throughout.
- [ ] **Step 3:** Menu: add «Media» → `/super-admin/cms/media` to the "cms" group in `sidebar-nav.tsx` (ri icon RiImage2Line/RiImage2Fill — verify; substitute if needed).
- [ ] **Step 4:** `npm run build` → success; route present. Commit `git add "app/(company)/super-admin/cms/media" components/admin/sidebar-nav.tsx && git commit -m "feat(media): gallery page (upload/browse/edit/delete) + menu"`.

---

## Task 4: `<MediaPicker/>` reusable component

**Files:** Create `components/cms/MediaPicker.tsx`.

- [ ] **Step 1:** `MediaPicker.tsx` ('use client'):
  - Props: `{ value: string | string[] | null; onChange: (v: string | string[]) => void; multiple?: boolean; accept?: "image" | "video" | "all" }` (value = MediaAsset id(s)).
  - Renders: a preview area of the currently-selected asset(s) (fetched once via a client fetch to a small read endpoint OR passed-in resolved assets — simplest: maintain a local cache; fetch `/api/cms/media/list` — create a tiny GET route `app/api/cms/media/list/route.ts` returning `listMedia({type})` JSON, SUPER_ADMIN-guarded) + a "Επιλογή από βιβλιοθήκη" CmsButton.
  - Clicking opens a Modal: a grid of assets (from the list endpoint, filtered by `accept`), search, click to select (single → close; multiple → toggle + a "Τέλος" button). An "Ανέβασμα" action inside (POST upload route → adds → auto-selects).
  - On select, call `onChange(id or ids)` and show previews.
  - Create the GET list route `app/api/cms/media/list/route.ts` (SUPER_ADMIN-guarded) returning `{ items: await listMedia({ type: accept==="image"?undefined:... }) }` — accept filtering can be client-side; keep the route returning all, filter in the component.
- [ ] **Step 2:** `npx tsc --noEmit | grep -i "MediaPicker\|media/list" || echo ok`; `npm run build`. Commit `git add components/cms/MediaPicker.tsx app/api/cms/media/list && git commit -m "feat(media): reusable MediaPicker (library + upload, single/multi)"`.

---

## Task 5: Final verification

- [ ] **Step 1:** `npm run test` (all pass) + `npm run build` (success).
- [ ] **Step 2:** Manual (needs DB+CDN): upload a PNG with transparency → stored as `.webp` ≤1920w, alpha preserved; upload an SVG → stored as-is; upload an MP4 → stored as-is, type VIDEO; gallery shows them; edit alt/title; delete removes CDN object + row; MediaPicker selects single/multi.
- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -iE "media|MediaPicker" || echo ok`. Commit fixes.

## Done = Media library ready for the Blog (Σύστημα 2) to consume via MediaPicker + getMediaByIds.
