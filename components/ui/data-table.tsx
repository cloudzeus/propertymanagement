"use client";

import {
  useState, useEffect, useRef, Fragment,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  RiDraggable, RiArrowUpSLine, RiArrowDownSLine, RiArrowUpDownLine,
  RiMoreLine, RiEyeLine, RiEyeOffLine, RiSearchLine, RiCloseCircleLine,
  RiCheckLine, RiArrowLeftSLine, RiArrowRightSLine, RiAddLine,
} from "react-icons/ri";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ColDef<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortKey?: string;
  defaultVisible?: boolean;
  width?: number;
  minWidth?: number;
  /** Plain value for client-side search & sort (clientSide mode). */
  accessor?: (row: T) => string | number | null | undefined;
};

export type RowAction<T> = {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  danger?: boolean;
};

export type BatchAction<T> = {
  label: string;
  icon?: React.ReactNode;
  onClick: (rows: T[]) => void;
  danger?: boolean;
};

export type DataTableProps<T extends { id: string }> = {
  data: T[];
  columns: ColDef<T>[];
  totalRows: number;
  page: number;
  pageSize: number;
  searchQuery?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  expandedContent?: (row: T) => React.ReactNode;
  getRowActions?: (row: T) => RowAction<T>[];
  batchActions?: BatchAction<T>[];
  onReorder?: (rows: T[]) => Promise<void> | void;
  onAddNew?: () => void;
  addNewLabel?: string;
  storageKey: string;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  /** Handle search/sort/paging in-memory instead of via URL params.
   *  Pass the full dataset as `data`; totalRows/page/pageSize become initial values. */
  clientSide?: boolean;
};

const PAGE_SIZES = [10, 25, 50, 100];

// ─── Main component ───────────────────────────────────────────────────────────
export function DataTable<T extends { id: string }>({
  data, columns, totalRows, page, pageSize,
  searchQuery = "", sortBy, sortDir,
  expandedContent, getRowActions, batchActions,
  onReorder, onAddNew, addNewLabel = "Προσθήκη",
  storageKey, searchPlaceholder = "Αναζήτηση…", toolbar,
  clientSide = false,
}: DataTableProps<T>) {
  const router    = useRouter();
  const pathname  = usePathname();
  const urlParams = useSearchParams();

  const defaultVisible = Object.fromEntries(columns.map((c) => [c.id, c.defaultVisible ?? true]));
  const defaultWidths  = Object.fromEntries(columns.map((c) => [c.id, c.width ?? 160]));

  const [visibility, setVisibility]   = useState<Record<string, boolean>>(defaultVisible);
  const [colWidths, setColWidths]     = useState<Record<string, number>>(defaultWidths);
  const [rows, setRows]               = useState<T[]>(data);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState(searchQuery);
  // Client-side mode state (in-memory search/sort/paging)
  const [cSortBy, setCSortBy]     = useState<string | undefined>(sortBy);
  const [cSortDir, setCSortDir]   = useState<"asc" | "desc">(sortDir ?? "asc");
  const [cPage, setCPage]         = useState(1);
  const [cPageSize, setCPageSize] = useState(pageSize);
  const [showColMenu, setShowColMenu] = useState(false);
  const [hoveredId, setHoveredId]     = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const colMenuRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { setRows(data); setSelected(new Set()); }, [data]);

  useEffect(() => {
    const stored = localStorage.getItem(`${storageKey}:cols`);
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setVisibility((prev) => ({ ...prev, ...p.visibility }));
        setColWidths((prev)   => ({ ...prev, ...p.widths }));
      } catch { /* ignore */ }
    }
  }, [storageKey]);

  function save(vis: Record<string, boolean>, w: Record<string, number>) {
    localStorage.setItem(`${storageKey}:cols`, JSON.stringify({ visibility: vis, widths: w }));
  }

  function pushParam(key: string, value: string | null) {
    const p = new URLSearchParams(urlParams.toString());
    if (value === null || value === "") p.delete(key);
    else p.set(key, value);
    if (key !== "page") p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  function handleSearch(v: string) {
    setSearchInput(v);
    if (clientSide) { setCPage(1); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => pushParam("search", v || null), 350);
  }

  function handleSort(key: string) {
    if (clientSide) {
      if (cSortBy === key) setCSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setCSortBy(key); setCSortDir("asc"); }
      setCPage(1);
      return;
    }
    const p = new URLSearchParams(urlParams.toString());
    if (sortBy === key) p.set("sortDir", sortDir === "asc" ? "desc" : "asc");
    else { p.set("sortBy", key); p.set("sortDir", "asc"); }
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  const visibleColsList = columns.filter((c) => visibility[c.id] !== false);

  // ── Client-side data pipeline (search → sort → paginate) ──
  function cellValue(row: T, col: ColDef<T>): string | number | null | undefined {
    if (col.accessor) return col.accessor(row);
    if (col.sortKey) return (row as Record<string, unknown>)[col.sortKey] as string | number | null;
    return undefined;
  }

  let processed = data;
  if (clientSide) {
    const q = searchInput.trim().toLowerCase();
    if (q) {
      processed = processed.filter((r) =>
        visibleColsList.some((c) => String(cellValue(r, c) ?? "").toLowerCase().includes(q))
      );
    }
    if (cSortBy) {
      const col = columns.find((c) => c.sortKey === cSortBy);
      processed = [...processed].sort((a, b) => {
        const av = col ? cellValue(a, col) : undefined;
        const bv = col ? cellValue(b, col) : undefined;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av).localeCompare(String(bv), "el");
      });
      if (cSortDir === "desc") processed.reverse();
    }
  }

  const effTotal    = clientSide ? processed.length : totalRows;
  const effPageSize = clientSide ? cPageSize : pageSize;
  const effPage     = clientSide ? Math.min(cPage, Math.max(1, Math.ceil(effTotal / effPageSize))) : page;
  const totalPages  = Math.max(1, Math.ceil(effTotal / effPageSize));
  const pageRows    = clientSide
    ? processed.slice((effPage - 1) * effPageSize, effPage * effPageSize)
    : rows;

  function goPage(p: number) {
    if (clientSide) { setCPage(p); return; }
    pushParam("page", String(p));
  }
  function changePageSize(n: number) {
    if (clientSide) { setCPageSize(n); setCPage(1); return; }
    const p = new URLSearchParams(urlParams.toString());
    p.set("pageSize", String(n)); p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  function toggleCol(id: string) {
    setVisibility((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      save(next, colWidths);
      return next;
    });
  }

  useEffect(() => {
    function h(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node))
        setShowColMenu(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function startResize(id: string, startX: number, startW: number) {
    const onMove = (e: PointerEvent) => {
      const w = Math.max(columns.find((c) => c.id === id)?.minWidth ?? 60, startW + e.clientX - startX);
      setColWidths((prev) => ({ ...prev, [id]: w }));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      setColWidths((prev) => { save(visibility, prev); return prev; });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((prev) => {
      const ids = pageRows.map((r) => r.id);
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
      return allOn ? new Set() : new Set(ids);
    });
  }
  function toggleExpand(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRows((items) => {
        const oi   = items.findIndex((r) => r.id === active.id);
        const ni   = items.findIndex((r) => r.id === over.id);
        const next = arrayMove(items, oi, ni);
        onReorder?.(next);
        return next;
      });
    }
  }

  const visibleCols  = visibleColsList;
  const viewRows     = pageRows;
  const effSortBy    = clientSide ? cSortBy : sortBy;
  const effSortDir   = clientSide ? cSortDir : sortDir;
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const allSelected  = viewRows.length > 0 && viewRows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;
  const hasExpand    = Boolean(expandedContent);
  const hasDrag      = Boolean(onReorder);
  const hasActions   = Boolean(getRowActions);
  const colCount     = 1 + (hasExpand ? 1 : 0) + (hasDrag ? 1 : 0) + visibleCols.length + (hasActions ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{
        background: "var(--card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.06)",
      }}>

        {/* ── Command bar ───────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 12px", height: 44,
          borderBottom: "1px solid var(--border)",
          background: "var(--card)",
        }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 auto", maxWidth: 280 }}>
            <RiSearchLine size={13} style={{
              position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
              color: "var(--muted-foreground)", pointerEvents: "none",
            }} />
            <input
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: "100%", height: 30, paddingLeft: 28,
                paddingRight: searchInput ? 28 : 10,
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12,
                outline: "none", fontFamily: "inherit", color: "var(--foreground)",
                background: "var(--muted)", boxSizing: "border-box",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--primary)"; e.target.style.background = "var(--card)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "var(--border)";  e.target.style.background = "var(--muted)"; }}
            />
            {searchInput && (
              <button onClick={() => handleSearch("")} style={{
                position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: "var(--muted-foreground)", display: "flex",
              }}>
                <RiCloseCircleLine size={13} />
              </button>
            )}
          </div>

          {toolbar}
          <div style={{ flex: 1 }} />

          {/* Column toggle */}
          <div ref={colMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowColMenu((v) => !v)}
              style={{
                height: 30, padding: "0 10px", borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: showColMenu ? "var(--muted)" : "var(--card)",
                fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                color: "var(--muted-foreground)",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <RiEyeLine size={13} /> Στήλες
            </button>
            {showColMenu && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50,
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-card)",
                padding: "4px 0", minWidth: 190,
              }}>
                {columns.map((c) => (
                  <button key={c.id} onClick={() => toggleCol(c.id)} style={{
                    display: "flex", alignItems: "center", gap: 9, width: "100%",
                    padding: "6px 12px", border: "none", background: "transparent",
                    cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                    color: "var(--foreground)", textAlign: "left",
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{
                      width: 15, height: 15, borderRadius: 3, border: "1.5px solid",
                      borderColor: visibility[c.id] !== false ? "var(--primary)" : "var(--border)",
                      background:  visibility[c.id] !== false ? "var(--primary)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, color: "var(--primary-foreground)", transition: "all 80ms",
                    }}>
                      {visibility[c.id] !== false && <RiCheckLine size={9} />}
                    </span>
                    {visibility[c.id] !== false
                      ? <RiEyeLine size={12} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                      : <RiEyeOffLine size={12} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />}
                    {c.header}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add new */}
          {onAddNew && (
            <button onClick={onAddNew} style={{
              height: 30, padding: "0 12px", borderRadius: 4,
              border: "1px solid var(--primary)",
              background: "var(--primary)", color: "var(--primary-foreground)",
              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 5,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              <RiAddLine size={14} /> {addNewLabel}
            </button>
          )}
        </div>

        {/* ── Batch action bar ──────────────────────────────── */}
        {selected.size > 0 && batchActions && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "6px 12px",
            background: `color-mix(in oklch, var(--primary) 8%, var(--card))`,
            borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: 12, color: "var(--foreground)", fontWeight: 500 }}>
              {selected.size} επιλεγμένα
            </span>
            {batchActions.map((a, i) => (
              <button key={i} onClick={() => a.onClick(selectedRows)} style={{
                height: 28, padding: "0 10px", borderRadius: 4, border: "1px solid",
                borderColor: a.danger ? `color-mix(in oklch, var(--destructive) 40%, transparent)` : "var(--border)",
                background:  a.danger ? `color-mix(in oklch, var(--destructive) 10%, var(--card))` : "var(--card)",
                color: a.danger ? "var(--destructive)" : "var(--foreground)",
                fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 5, fontWeight: 500,
              }}>
                {a.icon}{a.label}
              </button>
            ))}
            <button onClick={() => setSelected(new Set())} style={{
              height: 28, padding: "0 10px", borderRadius: 4,
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--muted-foreground)", fontSize: 11, cursor: "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4,
            }}>
              <RiCloseCircleLine size={13} /> Εκκαθάριση
            </button>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────── */}
        <div style={{ overflowX: "auto" }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
              <colgroup>
                {hasExpand  && <col style={{ width: 36 }} />}
                <col style={{ width: 40 }} />
                {hasDrag    && <col style={{ width: 36 }} />}
                {visibleCols.map((c) => (
                  <col key={c.id} style={{ width: colWidths[c.id] ?? c.width ?? 160 }} />
                ))}
                {hasActions && <col style={{ width: 44 }} />}
              </colgroup>

              <thead>
                <tr style={{
                  background: "color-mix(in oklch, var(--muted) 70%, var(--card) 30%)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  {hasExpand && <th style={thStyle} />}
                  <th style={thStyle}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--primary)" }}
                    />
                  </th>
                  {hasDrag && <th style={thStyle} />}
                  {visibleCols.map((c) => (
                    <HeaderCell
                      key={c.id}
                      col={c}
                      sortBy={effSortBy}
                      sortDir={effSortDir}
                      colWidth={colWidths[c.id] ?? c.width ?? 160}
                      onSort={handleSort}
                      onResizeStart={startResize}
                    />
                  ))}
                  {hasActions && <th style={thStyle} />}
                </tr>
              </thead>

              <SortableContext items={viewRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {viewRows.length === 0 && (
                    <tr>
                      <td colSpan={99} style={{
                        padding: "48px 16px", textAlign: "center",
                        color: "var(--muted-foreground)", fontSize: 13, fontFamily: "inherit",
                      }}>
                        Δεν βρέθηκαν εγγραφές
                      </td>
                    </tr>
                  )}
                  {viewRows.map((row, i) => (
                    <SortableRow
                      key={row.id}
                      row={row}
                      index={i}
                      visibleCols={visibleCols}
                      selected={selected.has(row.id)}
                      isExpanded={expanded.has(row.id)}
                      isHovered={hoveredId === row.id}
                      onSelect={() => toggleSelect(row.id)}
                      onExpand={expandedContent ? () => toggleExpand(row.id) : undefined}
                      onHover={(id) => setHoveredId(id)}
                      expandedContent={expandedContent}
                      rowActions={getRowActions?.(row)}
                      showDrag={hasDrag}
                      isLast={i === viewRows.length - 1}
                      colCount={colCount}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>

        {/* ── Pagination footer ─────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 12px", height: 40,
          borderTop: "1px solid var(--border)",
          background: "var(--card)",
          flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "inherit" }}>
              Γραμμές ανά σελίδα:
            </span>
            <select
              value={effPageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              style={{
                height: 26, padding: "0 6px", borderRadius: 4,
                border: "1px solid var(--border)", fontSize: 11,
                fontFamily: "inherit", cursor: "pointer",
                background: "var(--card)", color: "var(--foreground)",
              }}
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "inherit", marginRight: 6 }}>
              {Math.min((effPage - 1) * effPageSize + 1, effTotal)}–{Math.min(effPage * effPageSize, effTotal)} από {effTotal}
            </span>
            <button
              onClick={() => goPage(effPage - 1)} disabled={effPage <= 1}
              style={{ ...pageBtnStyle, opacity: effPage <= 1 ? 0.35 : 1, cursor: effPage <= 1 ? "not-allowed" : "pointer" }}
            >
              <RiArrowLeftSLine size={14} />
            </button>
            {buildPageWindow(effPage, totalPages).map((p, i) =>
              p === "…"
                ? <span key={`e${i}`} style={{ width: 26, textAlign: "center", fontSize: 11, color: "var(--muted-foreground)" }}>…</span>
                : <button
                    key={p}
                    onClick={() => goPage(p as number)}
                    style={{
                      ...pageBtnStyle,
                      background:   p === effPage ? "var(--primary)"            : "transparent",
                      color:        p === effPage ? "var(--primary-foreground)"  : "var(--foreground)",
                      borderColor:  p === effPage ? "var(--primary)"             : "var(--border)",
                      fontWeight:   p === effPage ? 600 : 400,
                    }}
                  >
                    {p}
                  </button>
            )}
            <button
              onClick={() => goPage(effPage + 1)} disabled={effPage >= totalPages}
              style={{ ...pageBtnStyle, opacity: effPage >= totalPages ? 0.35 : 1, cursor: effPage >= totalPages ? "not-allowed" : "pointer" }}
            >
              <RiArrowRightSLine size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Header cell ──────────────────────────────────────────────────────────────
function HeaderCell<T>({
  col, sortBy, sortDir, colWidth, onSort, onResizeStart,
}: {
  col: ColDef<T>;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  colWidth: number;
  onSort: (key: string) => void;
  onResizeStart: (id: string, startX: number, startW: number) => void;
}) {
  const [handleHovered, setHandleHovered] = useState(false);

  return (
    <th style={{ ...thStyle, position: "relative", userSelect: "none", paddingRight: 20 }}>
      <div
        onClick={() => col.sortKey && onSort(col.sortKey)}
        style={{ display: "flex", alignItems: "center", gap: 4, cursor: col.sortKey ? "pointer" : "default", overflow: "hidden" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.header}</span>
        {col.sortKey && (
          sortBy === col.sortKey
            ? sortDir === "asc"
              ? <RiArrowUpSLine   size={13} style={{ flexShrink: 0, color: "var(--primary)" }} />
              : <RiArrowDownSLine size={13} style={{ flexShrink: 0, color: "var(--primary)" }} />
            : <RiArrowUpDownLine  size={13} style={{ flexShrink: 0, color: "var(--border)" }} />
        )}
      </div>
      <div
        onMouseEnter={() => setHandleHovered(true)}
        onMouseLeave={() => setHandleHovered(false)}
        onPointerDown={(e) => { e.preventDefault(); onResizeStart(col.id, e.clientX, colWidth); }}
        style={{ position: "absolute", right: 0, top: "20%", bottom: "20%", width: 4, cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ width: 2, height: "100%", borderRadius: 1, background: handleHovered ? "var(--primary)" : "var(--border)", transition: "background 120ms" }} />
      </div>
    </th>
  );
}

// ─── Sortable row ─────────────────────────────────────────────────────────────
function SortableRow<T extends { id: string }>({
  row, index, visibleCols, selected, isExpanded, isHovered,
  onSelect, onExpand, onHover, expandedContent, rowActions,
  showDrag, isLast, colCount,
}: {
  row: T; index: number; visibleCols: ColDef<T>[];
  selected: boolean; isExpanded: boolean; isHovered: boolean;
  onSelect: () => void; onExpand?: () => void; onHover: (id: string | null) => void;
  expandedContent?: (row: T) => React.ReactNode;
  rowActions?: RowAction<T>[];
  showDrag: boolean; isLast: boolean; colCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id });
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos]     = useState({ top: 0, right: 0 });
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  function openMenu() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setMenuOpen(true);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function h(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const stripeBg = index % 2 === 0 ? "var(--card)" : "#F5F4F3";
  const rowBg = isDragging
    ? `color-mix(in oklch, var(--primary) 14%, var(--card))`
    : selected
      ? `color-mix(in oklch, var(--primary) 10%, var(--card))`
      : isHovered
        ? "#EBF3FB"
        : stripeBg;

  return (
    <Fragment>
      <tr
        ref={setNodeRef}
        suppressHydrationWarning
        style={{
          background: rowBg,
          borderBottom: !(isLast && !isExpanded) ? "1px solid color-mix(in oklch, var(--border) 60%, transparent)" : "none",
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.85 : 1,
        }}
        {...attributes}
        onMouseEnter={() => onHover(row.id)}
        onMouseLeave={() => onHover(null)}
      >
        {/* Expand toggle */}
        {onExpand !== undefined && (
          <td style={{ ...tdStyle, width: 36, textAlign: "center" }}>
            <button onClick={onExpand} style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 20, height: 20, borderRadius: 3,
              border: "1px solid var(--border)",
              background: isExpanded ? "var(--muted)" : "transparent",
              cursor: "pointer", color: "var(--muted-foreground)",
              transition: "transform 180ms",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}>
              <RiArrowDownSLine size={12} />
            </button>
          </td>
        )}

        {/* Checkbox */}
        <td style={{ ...tdStyle, width: 40, textAlign: "center" }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--primary)" }}
          />
        </td>

        {/* Drag handle */}
        {showDrag && (
          <td style={{ ...tdStyle, width: 36, cursor: "grab", textAlign: "center" }} {...listeners}>
            <RiDraggable size={14} style={{ color: "var(--border)" }} />
          </td>
        )}

        {/* Data cells */}
        {visibleCols.map((c) => (
          <td key={c.id} style={{ ...tdStyle, overflow: "hidden" }}>
            <div style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
              {c.cell(row)}
            </div>
          </td>
        ))}

        {/* Row actions dropdown */}
        {rowActions && (
          <td style={{ ...tdStyle, width: 44, textAlign: "center" }}>
            <button
              ref={btnRef}
              onClick={openMenu}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 26, height: 26, borderRadius: 4,
                border: "1px solid var(--border)",
                background: menuOpen ? "var(--muted)" : "transparent",
                cursor: "pointer", color: "var(--muted-foreground)",
                opacity: isHovered || menuOpen ? 1 : 0,
                transition: "opacity 120ms",
              }}
            >
              <RiMoreLine size={14} />
            </button>

            {menuOpen && isMounted && createPortal(
              <div ref={menuRef} style={{
                position: "fixed", top: menuPos.top, right: menuPos.right,
                zIndex: 9999, background: "var(--card)",
                border: "1px solid var(--border)", borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: "4px 0", minWidth: 170,
              }}>
                {rowActions.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => { a.onClick(row); setMenuOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "7px 12px", border: "none", background: "transparent",
                      cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                      color: a.danger ? "var(--destructive)" : "var(--foreground)",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = a.danger ? `color-mix(in oklch, var(--destructive) 8%, var(--card))` : "var(--muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {a.icon && <span style={{ flexShrink: 0 }}>{a.icon}</span>}
                    {a.label}
                  </button>
                ))}
              </div>,
              document.body,
            )}
          </td>
        )}
      </tr>

      {/* Expanded row */}
      {expandedContent && isExpanded && (
        <tr style={{
          borderBottom: isLast ? "none" : "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
          background: `color-mix(in oklch, var(--primary) 3.5%, var(--card))`,
        }}>
          <td
            colSpan={colCount}
            style={{
              paddingTop: 12, paddingBottom: 16, paddingRight: 16,
              paddingLeft: (onExpand !== undefined ? 36 : 0) + 40 + (showDrag ? 36 : 0) + 12,
              fontSize: 12, color: "var(--muted-foreground)",
              borderLeft: "3px solid var(--primary)",
            }}
          >
            {expandedContent(row)}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildPageWindow(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (page > 3) pages.push("…");
  for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.push(i);
  if (page < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

const thStyle: React.CSSProperties = {
  padding: "0 12px", height: 34, textAlign: "left",
  fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "var(--muted-foreground)",
  whiteSpace: "nowrap", verticalAlign: "middle", fontFamily: "inherit",
};

const tdStyle: React.CSSProperties = {
  padding: "0 12px", height: 40, fontSize: 13,
  color: "var(--foreground)", verticalAlign: "middle", fontFamily: "inherit",
};

const pageBtnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 4,
  border: "1px solid var(--border)",
  background: "transparent", cursor: "pointer",
  fontSize: 11, fontFamily: "inherit", color: "var(--foreground)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
