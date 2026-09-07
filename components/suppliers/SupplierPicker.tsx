"use client";

import { useEffect, useState } from "react";
import { FieldSelect } from "@/components/ui/modal";
import { listSupplierOptionsForBuilding } from "@/app/actions/suppliers";
import { SCOPE_LABELS, normalizeAfm, type SupplierOption } from "@/lib/suppliers-shared";

/**
 * Supplier <select> for a building's forms (expenses, recurring tasks).
 * Loads the options the viewer may see for that building; when `matchAfm`
 * is given and the value is empty, auto-selects the option with that ΑΦΜ.
 */
export function SupplierPicker({ buildingId, value, onChange, matchAfm, placeholder = "— Χωρίς σύνδεση —", onOptions }: {
  buildingId: string;
  value: string;
  onChange: (id: string) => void;
  matchAfm?: string | null;
  placeholder?: string;
  onOptions?: (opts: SupplierOption[]) => void;
}) {
  const [options, setOptions] = useState<SupplierOption[] | null>(null);

  useEffect(() => {
    let alive = true;
    listSupplierOptionsForBuilding(buildingId).then((opts) => {
      if (!alive) return;
      setOptions(opts);
      onOptions?.(opts);
    }).catch(() => alive && setOptions([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  // Auto-link by ΑΦΜ once options arrive (OCR flow).
  useEffect(() => {
    if (!options || value) return;
    const norm = normalizeAfm(matchAfm);
    if (!norm) return;
    const hit = options.find((o) => normalizeAfm(o.afm) === norm);
    if (hit) onChange(hit.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, matchAfm]);

  return (
    <FieldSelect
      value={value}
      onChange={onChange}
      disabled={options === null}
      placeholder={options === null ? "Φόρτωση…" : placeholder}
      options={(options ?? []).map((o) => ({ value: o.id, label: o.scope === "private" ? o.name : `${o.name} · ${SCOPE_LABELS[o.scope]}` }))}
    />
  );
}
