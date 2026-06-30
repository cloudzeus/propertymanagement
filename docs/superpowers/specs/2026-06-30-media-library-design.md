# Media Library (CMS foundation) — Design

**Ημερομηνία:** 2026-06-30
**Κατάσταση:** Approved
**Μέρος του:** Blog/Media feature. Σύστημα 1 (foundation). Ακολουθεί Σύστημα 2 (Blog/Articles), που το καταναλώνει.

## Στόχος

Κοινή βιβλιοθήκη media για το CMS: ανέβασμα/περιήγηση/επιλογή assets, με **αυτόματη μετατροπή εικόνων σε WebP (max width 1920, διατήρηση διαφάνειας), εκτός SVG**· video αποθηκεύονται ως έχουν. Reusable `<MediaPicker/>` για χρήση παντού (featured, gallery, OG images).

## Πλαίσιο / υπάρχοντα
- `lib/bunnycdn.ts`: `uploadFile({path,buffer,contentType}) → {success,url}` (url = `${BUNNY_CDN_URL}/${path}`), `deleteFile(path)`. Bunny S3.
- `sharp` ^0.35.2 εγκατεστημένο. `app/actions/brand.ts` ΕΧΕΙ ήδη το pattern: `sharp(input).webp({quality:90}).toBuffer()` (alpha by default)· SVG ως έχει· `cdnPathFromUrl(url)` helper. **Διαβάστε το brand.ts** — το media pipeline το επεκτείνει (προσθήκη `.resize({width:1920, withoutEnlargement:true})` + resolveWithObject για width/height).
- CMS UI kit (`components/cms/ui.tsx`), DataTable/Modal, CMS menu group, `requireSuperAdmin` pattern, `revalidatePath`.

## Ενότητα 1 — `MediaAsset` model
```prisma
model MediaAsset {
  id           String   @id @default(cuid())
  type         String   // "IMAGE" | "SVG" | "VIDEO"
  url          String
  cdnPath      String   // storage key (for delete)
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
Migration (diff+deploy).

## Ενότητα 2 — Upload pipeline
Λόγω του Next server-action body limit (~1MB), τα uploads γίνονται μέσω **Route Handler** `POST /api/cms/media/upload` (SUPER_ADMIN-guarded, ελέγχει `auth()` role):
- FormData `file` (+ optional `alt`,`title`).
- Detect: SVG (mime `image/svg+xml` ή `.svg`) → upload ως έχει, type SVG.
- image (mime `image/*`) → `sharp(input).rotate().resize({width:1920, withoutEnlargement:true}).webp({quality:82}).toBuffer({resolveWithObject:true})` → upload webp, capture `info.width/height`, type IMAGE. (`.rotate()` σέβεται EXIF orientation.)
- video (mime `video/*`) → upload ως έχει, type VIDEO (χωρίς conversion).
- path `media/${id}.${ext}` (id = cuid/random). create `MediaAsset`, return JSON.
- Όριο μεγέθους: εικόνες ~25MB, video ~200MB (έλεγχος μεγέθους· μήνυμα αν υπερβαίνει). Config `serverActions`/route δεν χρειάζεται bodySizeLimit (route handler streams).
Server actions (`app/actions/media.ts`, SUPER_ADMIN): `deleteMedia(id)` (deleteFile(cdnPath)+delete row), `updateMediaMeta(id,{alt,title})`. Accessor `lib/cms/media.ts`: `listMedia({type?,q?})`, `getMediaByIds(ids)` (ordered).

## Ενότητα 3 — Media gallery UI
`/super-admin/cms/media` (CMS UI kit): `CmsPage` header + DataTable **ή** grid of thumbnails (προτίμηση grid για media: preview cards). Κάθε card: preview (img webp/svg· video → poster/icon), title/alt, dimensions + type badge, actions (edit alt/title σε Modal, delete με confirm). Toolbar: **Upload** (file input multiple / drag-drop → POST route → refresh), search (title/alt), type filter. Menu item «Media» στο CMS group.

## Ενότητα 4 — `<MediaPicker/>` (reusable)
`components/cms/MediaPicker.tsx` ('use client'): κουμπί που ανοίγει Modal με (α) tab «Βιβλιοθήκη» (grid + search + type filter, select single ή multi βάσει prop `multiple`), (β) tab «Ανέβασμα» (upload → προστίθεται & επιλέγεται). Props: `{ value, onChange, multiple?, accept? ("image"|"video"|"all") }`. Επιστρέφει MediaAsset id(s) + δείχνει preview των επιλεγμένων. Θα το χρησιμοποιήσει ο article editor (featured single, gallery multi) στο Σύστημα 2.

## Out of scope
- Image cropping/focal point, CDN purge, video transcoding/thumbnails generation, folders/tags για media (flat library· search αρκεί).
- Χρήση στο Blog (Σύστημα 2).

## Σημεία προσοχής
- WebP `resolveWithObject:true` για width/height· `.rotate()` για EXIF.
- Διαγραφή: σβήσε και το CDN object (cdnPath) — best-effort, μη ρίξεις αν αποτύχει.
- Route handler auth: re-check SUPER_ADMIN (μην βασιστείς μόνο στο proxy — τα /api routes εξαιρούνται από κάποια guards· το /api/cms/media/* πρέπει να φρουρηθεί ρητά).
- Μεγάλα video: stream το body· μην το φορτώσεις όλο στη μνήμη αν αποφεύγεται (αλλά το sharp αφορά μόνο εικόνες· video → pass-through buffer, αποδεκτό για λογικά μεγέθη).
- Επαναχρησιμοποίησε `lib/bunnycdn.ts` (μην ξαναγράψεις S3).
