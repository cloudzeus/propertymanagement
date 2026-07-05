export type MergeContext = {
  name?: string | null;
  building?: string | null;
  property?: string | null;
  unit?: string | null;
};

const KNOWN = ["name", "building", "property", "unit"] as const;

/** Replace {{name}}/{{building}}/{{property}}/{{unit}} per recipient.
 *  Missing values → "". Unknown tokens are left untouched. */
export function applyMergeFields(input: string, ctx: MergeContext): string {
  let out = input;
  for (const key of KNOWN) {
    const value = (ctx[key] ?? "") as string;
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}
