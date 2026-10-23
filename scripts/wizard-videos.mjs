#!/usr/bin/env node
/**
 * Imports the published Orithon guide videos into the app.
 *
 *   node scripts/wizard-videos.mjs [--manifest <path>] [--write-guides] [--dry-run]
 *
 * Reads motion-studio's publish manifest (default
 * /Volumes/EXTERNALSSD/PROJECTS/motion-studio/out/Orithon-Guide.publish.json, written by
 * `scripts/publish.mjs --filter Orithon-Guide`, shape { project, target, publishedAt,
 * files: [{ file, key, url, size, mime }] }) and the guide scripts
 * (src/projects/orithon/Guide/videos.ts: title per key, scene durations) and writes
 * lib/wizards/videos.ts — `WIZARD_VIDEOS[videoKey] = { src, poster, seconds, title }`,
 * keys sorted, deterministic. With --write-guides it also sets `video:` / `videoPoster:`
 * in the frontmatter of docs/wiki/guides/<guideSlug>.md for every wizard whose video exists.
 *
 * Only the mp4 + poster are referenced (videos are muted text+motion; webm is optional).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const studio = "/Volumes/EXTERNALSSD/PROJECTS/motion-studio";
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const manifestPath = arg("manifest", path.join(studio, "out", "Orithon-Guide.publish.json"));
const writeGuides = argv.includes("--write-guides");
const dry = argv.includes("--dry-run");

if (!fs.existsSync(manifestPath)) { console.error(`manifest not found: ${manifestPath}`); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const files = manifest.files ?? [];
const urlOf = (f) => f.url ?? null;

// ── guide scripts: title + seconds per key (transpile the TS data file with the project's TypeScript) ──
const require = createRequire(import.meta.url);
const ts = require("typescript");
const videosTs = fs.readFileSync(path.join(studio, "src/projects/orithon/Guide/videos.ts"), "utf8");
const js = ts.transpileModule(videosTs, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from "\.\/types"/g, 'from "./.types.mjs"');
const tmpDir = fs.mkdtempSync(path.join(root, ".superpowers", "tmp-videos-"));
fs.writeFileSync(path.join(tmpDir, ".types.mjs"), "export {};\n");
const tmp = path.join(tmpDir, "videos.mjs");
fs.writeFileSync(tmp, js);
const { GUIDE_VIDEOS } = await import(`file://${tmp}`);
fs.rmSync(tmpDir, { recursive: true, force: true });

// Same duration rules as motion-studio src/projects/orithon/Guide/index.tsx
const readSec = (t) => (t ? Math.min(9, Math.max(3, 0.4 + t.length / 17)) : 3);
const minSec = (s) => ({ title: 5, end: 6, why: 3 + 1.4 * (s.cards?.length ?? 0), flow: 3 + 1.1 * (s.steps?.length ?? 0), form: 4 + 1.0 * (s.fields?.length ?? 0), split: 6 + 0.9 * (s.parts?.length ?? 0), table: 3 + 0.5 * (s.rows?.length ?? 0), tree: 3 + 0.7 * (s.nodes?.length ?? 0), points: 3 + 1.2 * (s.points?.length ?? 0) })[s.type];
const seconds = (v) => Math.round(v.scenes.reduce((t, s) => t + (s.sec ?? Math.max(readSec(s.caption), minSec(s))), 0));

// ── assemble ──
const entries = {};
for (const v of GUIDE_VIDEOS) {
  const id = `Orithon-Guide-${v.key}-16x9`;
  const mp4 = files.find((f) => f.file === `${id}.mp4`);
  const poster = files.find((f) => f.file === `${id}-poster.jpg`);
  if (!mp4 || !urlOf(mp4)) { console.warn(`skip ${v.key}: no published mp4`); continue; }
  entries[v.key] = { src: urlOf(mp4), poster: poster ? urlOf(poster) : undefined, seconds: seconds(v), title: v.title };
}
const keys = Object.keys(entries).sort();

const header = fs.readFileSync(path.join(root, "lib/wizards/videos.ts"), "utf8").split("export const WIZARD_VIDEOS")[0];
const body = keys.length
  ? `export const WIZARD_VIDEOS: Record<string, WizardVideo> = {\n${keys.map((k) => { const e = entries[k]; return `  ${k}: { src: ${JSON.stringify(e.src)}, poster: ${JSON.stringify(e.poster ?? "")}, seconds: ${e.seconds}, title: ${JSON.stringify(e.title)} },`; }).join("\n")}\n};`
  : `export const WIZARD_VIDEOS: Record<string, WizardVideo> = {};`;
const out = `${header}${body}\n\nexport function videoForWizard(key: WizardKey): WizardVideo | null {\n  return WIZARD_VIDEOS[getWizard(key).videoKey] ?? null;\n}\n`;
if (dry) console.log(out); else fs.writeFileSync(path.join(root, "lib/wizards/videos.ts"), out);
console.log(`${keys.length} video(s): ${keys.join(", ") || "—"}`);

// ── guides frontmatter ──
if (writeGuides) {
  // registry: videoKey → guideSlug (regex over the TS source; no runtime import of app code)
  const reg = fs.readFileSync(path.join(root, "lib/wizards/registry.ts"), "utf8");
  const pairs = [...reg.matchAll(/videoKey:\s*"([A-Za-z]+)",\s*guideSlug:\s*"([a-z0-9-]+)"/g)].map((m) => [m[1], m[2]]);
  for (const [videoKey, slug] of pairs) {
    const e = entries[videoKey];
    const p = path.join(root, "docs/wiki/guides", `${slug}.md`);
    if (!e || !fs.existsSync(p)) continue;
    let md = fs.readFileSync(p, "utf8");
    const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!m) { console.warn(`no frontmatter: ${slug}`); continue; }
    let fm = m[1].split(/\r?\n/).filter((l) => !/^(video|videoPoster|minutes):/.test(l));
    fm.push(`video: ${e.src}`);
    if (e.poster) fm.push(`videoPoster: ${e.poster}`);
    fm.push(`minutes: ${Math.max(1, Math.round(e.seconds / 60))}`);
    md = `---\n${fm.join("\n")}\n---\n` + md.slice(m[0].length);
    if (!dry) fs.writeFileSync(p, md);
    console.log(`guide ${slug}: video set`);
  }
}
