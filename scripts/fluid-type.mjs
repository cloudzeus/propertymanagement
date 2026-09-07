#!/usr/bin/env node
// Regenerates the --fs-N fluid type tokens (see app/globals.css "Fluid type scale")
// from every font size used in the codebase. Prints the CSS block to stdout.
import { execSync } from "node:child_process";
const grab = (cmd) => execSync(cmd, { encoding: "utf8" }).split("\n").filter(Boolean);
const app = grab(`grep -rhoE "var\\(--fs-[0-9-]+\\)|fontSize: ?[0-9.]+" components app --include="*.tsx" | sed -E 's/fontSize: *//; s/var\\(--fs-([0-9-]+)\\)/\\1/; s/-/./'`);
const pub = grab(`grep -rhoE "text-\\[[0-9.]+px\\]" components app --include="*.tsx" | sed -E 's/text-\\[([0-9.]+)px\\]/\\1/'`);
const sizes = [...new Set([...app, ...pub, "14", "66"].map(Number))].filter(Number.isFinite).sort((a, b) => a - b);
const MINW = 360, MAXW = 1280, r = (v) => Number(v.toFixed(4));
const mobile = (d) => (d <= 15 ? d + 1 : d <= 20 ? d : Math.round(d * 0.78 * 2) / 2);
for (const d of sizes) {
  const m = mobile(d), name = String(d).replace(".", "-");
  if (m === d) { console.log(`  --fs-${name}: ${r(d / 16)}rem;`); continue; }
  const slope = (d - m) / (MAXW - MINW), intercept = m - slope * MINW;
  console.log(`  --fs-${name}: clamp(${r(Math.min(m, d) / 16)}rem, ${r(intercept / 16)}rem ${slope < 0 ? "-" : "+"} ${r(Math.abs(slope) * 100)}vw, ${r(Math.max(m, d) / 16)}rem);`);
}
