/** Remove `:::roles A,B … :::` blocks the role may not see; unwrap the others. */
export function filterRoleBlocks(md: string, role: string): string {
  const want = role.toUpperCase();
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let skipping = false, inBlock = false;
  for (const line of lines) {
    const open = line.match(/^:::roles\s+(.+)$/i);
    if (open && !inBlock) {
      inBlock = true;
      const allowed = open[1].split(/[\s,]+/).filter(Boolean).map((r) => r.toUpperCase());
      skipping = !allowed.includes(want);
      continue;
    }
    if (inBlock && /^:::\s*$/.test(line)) { inBlock = false; skipping = false; continue; }
    if (!skipping) out.push(line);
  }
  return out.join("\n");
}
