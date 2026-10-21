// Παράγει τα εικονίδια του PWA από το σύμβολο Orithon (public/orithon/orithon-symbol-black.png).
// Τρέξε: node scripts/pwa-icons.mjs  — ξανατρέξε το όταν αλλάξει το λογότυπο.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "public/orithon/orithon-symbol-black.png");
const BG = "#F6F4EC"; // --bg-canvas (κρεμ canvas της εφαρμογής)

/** Σύμβολο στο κέντρο ενός size×size κρεμ καμβά· symbolRatio = πλευρά συμβόλου / πλευρά καμβά. */
async function render(size, symbolRatio, outRel) {
  const side = Math.round(size * symbolRatio);
  const symbol = await sharp(SOURCE).resize(side, side, { fit: "inside" }).png().toBuffer();
  const out = path.join(ROOT, outRel);
  mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: symbol, gravity: "centre" }])
    .png()
    .toFile(out);
  console.log("wrote", outRel, `${size}x${size}`);
}

await render(192, 0.72, "public/icons/icon-192.png");
await render(512, 0.72, "public/icons/icon-512.png");
await render(512, 0.6, "public/icons/maskable-512.png"); // safe zone για maskable
await render(180, 0.72, "app/apple-icon.png"); // Next file convention → apple-touch-icon
