import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Το /offline προ-αποθηκεύεται από τον service worker χωρίς cookies. Αν το proxy.ts
 * το στείλει στο /login, η cache θα κρατήσει τη σελίδα σύνδεσης ως «offline».
 * Το proxy.ts δεν εξάγει τη λίστα (NextAuth wrapper), οπότε ελέγχουμε την πηγή.
 */
describe("PWA public paths in proxy.ts", () => {
  const src = readFileSync(path.resolve(__dirname, "../../proxy.ts"), "utf8");
  const authPublic = src.split("const authPublicPaths = [")[1]?.split("];")[0] ?? "";
  it("lists /offline among the public, non-localized paths", () => {
    expect(authPublic).toMatch(/"\/offline"/);
  });
  it("keeps the dot-path exclusion so /sw.js, /manifest.webmanifest and /icons/*.png bypass the middleware", () => {
    expect(src).toContain(".*\\\\..*");
  });
});
