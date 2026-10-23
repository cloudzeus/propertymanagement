/** Pure helpers of the GuidedFlow v2 component (components/ui/guided-flow.tsx). */

export const EXAMPLE_STEP_KEY = "__example";

export type FlowStepMeta = { key: string; title: string };
export type FlowStepRow<T extends FlowStepMeta> = T & { isExample: boolean };

/** The rail's step list: the caller's steps, plus the «Παράδειγμα εφαρμογής» step last when an example is given. */
export function withExampleStep<T extends FlowStepMeta>(steps: T[], example: { title?: string } | null | undefined): FlowStepRow<T>[] {
  const rows: FlowStepRow<T>[] = steps.map((s) => ({ ...s, isExample: false }));
  if (example) rows.push({ key: EXAMPLE_STEP_KEY, title: example.title ?? "Παράδειγμα εφαρμογής", isExample: true } as FlowStepRow<T>);
  return rows;
}

export function stepLabel(index: number, total: number): string {
  return `Βήμα ${index + 1} από ${total}`;
}

/** 80 → «1′20″» (video length on the «Δείτε το video» button). */
export function formatSeconds(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return `${m}′${String(s % 60).padStart(2, "0")}″`;
}
