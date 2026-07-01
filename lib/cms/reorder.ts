export type Orderable = { id: string };

/**
 * Given a desired id order and the existing rows, return each row's id with its
 * new sequential `order`. Unknown ids in `orderedIds` are ignored; rows absent
 * from `orderedIds` keep their relative order and are appended after.
 */
export function applyReorder<T extends Orderable>(
  orderedIds: string[],
  rows: T[],
): { id: string; order: number }[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const sequence: string[] = [];
  for (const id of orderedIds) {
    if (byId.has(id) && !seen.has(id)) {
      sequence.push(id);
      seen.add(id);
    }
  }
  for (const r of rows) {
    if (!seen.has(r.id)) sequence.push(r.id);
  }
  return sequence.map((id, i) => ({ id, order: i }));
}
