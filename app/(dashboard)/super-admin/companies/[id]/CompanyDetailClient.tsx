"use client";

import { useState } from "react";
import { InfoTab } from "./tabs/InfoTab";
import { DepartmentsTab } from "./tabs/DepartmentsTab";
import { PositionsTab } from "./tabs/PositionsTab";
import { EmployeesTab } from "./tabs/EmployeesTab";
import {
  RiBuildingLine, RiTeamLine, RiBriefcaseLine, RiUserLine, RiMapPin2Line,
} from "react-icons/ri";

type Props = {
  company: any;
  departments: any[];
  positions: any[];
  employees: any[];
};

const TABS = [
  { id: "info",        label: "Στοιχεία",      icon: RiBuildingLine },
  { id: "departments", label: "Τμήματα",        icon: RiTeamLine },
  { id: "positions",   label: "Θέσεις",         icon: RiBriefcaseLine },
  { id: "employees",   label: "Υπάλληλοι",      icon: RiUserLine },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CompanyDetailClient({ company, departments, positions, employees }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("info");

  return (
    <>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0,
        borderBottom: "1px solid var(--border)",
        marginBottom: 24,
      }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 18px",
                border: "none",
                borderBottom: active ? "2px solid var(--color-primary)" : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--color-primary)" : "var(--muted-foreground)",
                transition: "all 120ms",
                marginBottom: -1,
              }}
            >
              <Icon style={{ fontSize: 15 }} />
              {label}
              {id === "departments" && departments.length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 10,
                  background: active ? "var(--color-primary)22" : "var(--muted)",
                  color: active ? "var(--color-primary)" : "var(--muted-foreground)",
                }}>
                  {departments.length}
                </span>
              )}
              {id === "positions" && positions.length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 10,
                  background: active ? "var(--color-primary)22" : "var(--muted)",
                  color: active ? "var(--color-primary)" : "var(--muted-foreground)",
                }}>
                  {positions.length}
                </span>
              )}
              {id === "employees" && employees.length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 10,
                  background: active ? "var(--color-primary)22" : "var(--muted)",
                  color: active ? "var(--color-primary)" : "var(--muted-foreground)",
                }}>
                  {employees.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "info" && <InfoTab company={company} />}
      {activeTab === "departments" && (
        <DepartmentsTab companyId={company.id} initial={departments} />
      )}
      {activeTab === "positions" && (
        <PositionsTab
          companyId={company.id}
          initial={positions}
          departments={departments.map((d: any) => ({ id: d.id, name: d.name }))}
        />
      )}
      {activeTab === "employees" && (
        <EmployeesTab
          companyId={company.id}
          initial={employees}
          departments={departments.map((d: any) => ({ id: d.id, name: d.name }))}
          positions={positions.map((p: any) => ({ id: p.id, title: p.title, departmentId: p.departmentId }))}
        />
      )}
    </>
  );
}
