"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RiShieldUserLine,
  RiCheckLine,
  RiAddLine,
  RiRefreshLine,
  RiDeleteBinLine,
  RiSaveLine,
  RiLockLine,
} from "react-icons/ri";
import {
  saveRolePermissions,
  createCustomRole,
  deleteCustomRole,
  resetRoleToDefaults,
} from "@/app/actions/rbac";
import { USER_ROLES, ROLE_LABELS } from "@/lib/roles-constants";
import type { UserRole } from "@/lib/prisma/enums";

type RoleData = {
  id: string;
  key: string;
  label: string;
  baseRole: string;
  surface: string;
  isSystem: boolean;
  userCount: number;
  perms: string[];
};

type ModuleData = {
  key: string;
  label: string;
  surface: string;
  actions: string[];
};

type Props = { roles: RoleData[]; modules: ModuleData[] };

const ACTION_LABELS: Record<string, string> = {
  view: "Προβολή",
  create: "Δημιουργία",
  edit: "Επεξεργασία",
  delete: "Διαγραφή",
};

const ACTION_ORDER = ["view", "create", "edit", "delete"];

const SURFACE_LABELS: Record<string, string> = {
  company: "Εταιρεία",
  customer: "Πελάτης",
  marketplace: "Marketplace",
};

export function RoleEditor({ roles, modules }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string>(roles[0]?.id ?? "");
  const activeRole = roles.find((r) => r.id === activeId) ?? roles[0];

  const [checked, setChecked] = useState<Set<string>>(new Set(activeRole?.perms ?? []));
  const [loadedForId, setLoadedForId] = useState<string>(activeRole?.id ?? "");

  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newBaseRole, setNewBaseRole] = useState<string>(USER_ROLES[1] ?? USER_ROLES[0]);

  if (activeRole && loadedForId !== activeRole.id) {
    // sync local state when switching active role (render-time reset, safe here since it's a plain derived reset)
    setChecked(new Set(activeRole.perms));
    setLoadedForId(activeRole.id);
  }

  const isSuperAdmin = activeRole?.key === "SUPER_ADMIN";

  const relevantModules = useMemo(
    () => (activeRole ? modules.filter((m) => m.surface === activeRole.surface) : []),
    [modules, activeRole]
  );

  const groupedModules = useMemo(() => {
    const groups: Record<string, ModuleData[]> = {};
    for (const m of relevantModules) {
      (groups[m.surface] ??= []).push(m);
    }
    return groups;
  }, [relevantModules]);

  function toggle(moduleKey: string, action: string) {
    if (isSuperAdmin) return;
    const key = `${moduleKey}:${action}`;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSave() {
    if (!activeRole || isSuperAdmin) return;
    startTransition(async () => {
      await saveRolePermissions(activeRole.id, [...checked]);
      router.refresh();
    });
  }

  function handleReset() {
    if (!activeRole || isSuperAdmin) return;
    startTransition(async () => {
      await resetRoleToDefaults(activeRole.id);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!activeRole) return;
    if (!confirm(`Διαγραφή του ρόλου "${activeRole.label}"; Οι χρήστες θα επανέλθουν στον βασικό ρόλο.`)) return;
    startTransition(async () => {
      await deleteCustomRole(activeRole.id);
      setActiveId(roles[0]?.id ?? "");
      router.refresh();
    });
  }

  function handleCreate() {
    if (!newLabel.trim()) return;
    startTransition(async () => {
      const id = await createCustomRole(newLabel.trim(), newBaseRole as UserRole, []);
      setShowCreate(false);
      setNewLabel("");
      setActiveId(id);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Ρόλοι & Δικαιώματα</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            Επεξεργασία δικαιωμάτων ανά ρόλο και διαχείριση προσαρμοσμένων ρόλων
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            background: "#0078D4", color: "#fff", border: "none", borderRadius: "var(--radius)",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <RiAddLine style={{ fontSize: 16 }} /> Νέος ρόλος
        </button>
      </div>

      {showCreate && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 12px" }}>Δημιουργία προσαρμοσμένου ρόλου</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Όνομα ρόλου</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="π.χ. Βοηθός Διαχειριστή"
                style={{
                  padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  background: "var(--bg-canvas)", color: "var(--foreground)", fontSize: 13, minWidth: 220,
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Βασικός ρόλος</label>
              <select
                value={newBaseRole}
                onChange={(e) => setNewBaseRole(e.target.value)}
                style={{
                  padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  background: "var(--bg-canvas)", color: "var(--foreground)", fontSize: 13, minWidth: 200,
                }}
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={isPending || !newLabel.trim()}
              style={{
                padding: "8px 14px", background: "#107C10", color: "#fff", border: "none",
                borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: isPending || !newLabel.trim() ? 0.6 : 1,
              }}
            >
              Δημιουργία
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{
                padding: "8px 14px", background: "transparent", color: "var(--muted-foreground)",
                border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, cursor: "pointer",
              }}
            >
              Ακύρωση
            </button>
          </div>
        </div>
      )}

      {/* Role selector */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {roles.map((r) => {
          const active = r.id === activeRole?.id;
          return (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                background: active ? "var(--card)" : "transparent",
                border: `1px solid ${active ? "#0078D4" : "var(--border)"}`,
                borderRadius: "var(--radius)", cursor: "pointer",
              }}
            >
              <RiShieldUserLine style={{ fontSize: 15, color: active ? "#0078D4" : "var(--muted-foreground)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{r.label}</span>
              {r.isSystem && (
                <span style={{
                  fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)",
                  background: "var(--bg-canvas)", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "1px 6px", textTransform: "uppercase",
                }}>
                  system
                </span>
              )}
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{r.userCount} χρήστες</span>
            </button>
          );
        })}
      </div>

      {activeRole && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{activeRole.label}</h2>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                {SURFACE_LABELS[activeRole.surface] ?? activeRole.surface} · βασικός ρόλος: {ROLE_LABELS[activeRole.baseRole] ?? activeRole.baseRole}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {activeRole.isSystem && !isSuperAdmin && (
                <button
                  onClick={handleReset}
                  disabled={isPending}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                    background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", fontSize: 13, cursor: "pointer", opacity: isPending ? 0.6 : 1,
                  }}
                >
                  <RiRefreshLine style={{ fontSize: 15 }} /> Επαναφορά προεπιλογών
                </button>
              )}
              {!activeRole.isSystem && (
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                    background: "transparent", color: "#A4262C", border: "1px solid #A4262C55",
                    borderRadius: "var(--radius)", fontSize: 13, cursor: "pointer", opacity: isPending ? 0.6 : 1,
                  }}
                >
                  <RiDeleteBinLine style={{ fontSize: 15 }} /> Διαγραφή ρόλου
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isPending || isSuperAdmin}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                  background: "#0078D4", color: "#fff", border: "none",
                  borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  opacity: isPending || isSuperAdmin ? 0.6 : 1,
                }}
              >
                <RiSaveLine style={{ fontSize: 15 }} /> Αποθήκευση
              </button>
            </div>
          </div>

          {isSuperAdmin && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
              background: "#A4262C10", borderBottom: "1px solid var(--border)",
              fontSize: 12, color: "#A4262C", fontWeight: 500,
            }}>
              <RiLockLine style={{ fontSize: 15 }} />
              Ο Super Admin έχει πάντα πλήρη πρόσβαση (κλειδωμένο).
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            {Object.entries(groupedModules).map(([surface, mods]) => (
              <div key={surface}>
                <div style={{
                  padding: "8px 20px", background: "var(--bg-canvas)",
                  borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)",
                  fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.03em",
                }}>
                  {SURFACE_LABELS[surface] ?? surface}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", minWidth: 200 }}>
                        Λειτουργία
                      </th>
                      {ACTION_ORDER.map((a) => (
                        <th key={a} style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>
                          {ACTION_LABELS[a]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mods.map((m, i) => (
                      <tr key={m.key} style={{ borderBottom: i < mods.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <td style={{ padding: "10px 20px", fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{m.label}</td>
                        {ACTION_ORDER.map((a) => {
                          const supported = m.actions.includes(a);
                          const key = `${m.key}:${a}`;
                          const isChecked = isSuperAdmin ? supported : checked.has(key);
                          return (
                            <td key={a} style={{ padding: "10px 12px", textAlign: "center" }}>
                              {supported ? (
                                <label style={{ display: "inline-flex", cursor: isSuperAdmin ? "not-allowed" : "pointer" }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isSuperAdmin}
                                    onChange={() => toggle(m.key, a)}
                                    style={{ width: 16, height: 16, accentColor: "#0078D4", cursor: isSuperAdmin ? "not-allowed" : "pointer" }}
                                  />
                                </label>
                              ) : (
                                <span style={{ color: "var(--border)" }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {relevantModules.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
                Δεν υπάρχουν διαθέσιμες λειτουργίες για αυτό το surface.
              </div>
            )}
          </div>
        </div>
      )}

      {isSuperAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted-foreground)" }}>
          <RiCheckLine style={{ fontSize: 14, color: "#107C10" }} />
          Όλα τα δικαιώματα ενεργά για τον Super Admin.
        </div>
      )}
    </div>
  );
}
