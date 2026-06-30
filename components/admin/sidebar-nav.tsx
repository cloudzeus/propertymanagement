"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RiDashboardLine, RiDashboardFill,
  RiBuildingLine, RiBuildingFill,
  RiHome3Line, RiHome3Fill,
  RiGroupLine, RiGroupFill,
  RiShieldUserLine, RiShieldUserFill,
  RiSettingsLine, RiSettingsFill,
  RiBarChartLine, RiBarChart2Fill,
  RiMoneyDollarCircleLine, RiMoneyDollarCircleFill,
  RiToolsLine, RiToolsFill,
  RiNotification2Line, RiNotification2Fill,
  RiLinksLine, RiLinksFill,
  RiPaletteLine, RiPaletteFill,
  RiFileListLine, RiFileListFill,
  RiCalendarLine, RiCalendarFill,
  RiUserLine, RiUserFill,
  RiLogoutBoxRLine,
  RiMenuFoldLine, RiMenuUnfoldLine,
  RiArrowDownSLine,
  RiContactsLine, RiContactsFill, RiServiceLine, RiServiceFill,
  RiCommunityLine, RiCommunityFill,
  RiRobot2Line,
  RiEyeLine, RiEyeFill,
  RiLayoutLine, RiLayoutFill,
} from "react-icons/ri";

type UserRole =
  | "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE"
  | "PROPERTY_ADMIN" | "PROPERTY_OWNER" | "PROPERTY_RESIDENT"
  | "PROPERTY_VIEWER" | "COLLABORATOR";

// ─── Types ────────────────────────────────────────────────────────────────────
type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  iconActive: React.ElementType;
  color: string;
};
type NavGroup = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  items: NavItem[];
};

// ─── Nav configs per role ─────────────────────────────────────────────────────
const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  SUPER_ADMIN: [
    {
      id: "core", label: "Κεντρικό", icon: RiDashboardLine, color: "#0078D4",
      items: [
        { label: "Dashboard",    href: "/super-admin",              icon: RiDashboardLine,           iconActive: RiDashboardFill,          color: "#0078D4" },
        { label: "Αναφορές",     href: "/super-admin/reports",      icon: RiBarChartLine,            iconActive: RiBarChart2Fill,          color: "#107C10" },
      ],
    },
    {
      id: "management", label: "Διαχείριση", icon: RiBuildingLine, color: "#8764B8",
      items: [
        { label: "Νέα πολυκατοικία (AI)", href: "/super-admin/onboarding", icon: RiRobot2Line,        iconActive: RiRobot2Line,             color: "#CA5D00" },
        { label: "Πελάτες",      href: "/super-admin/customers",    icon: RiContactsLine,            iconActive: RiContactsFill,           color: "#038387" },
        { label: "Ιδιοκτησίες",  href: "/super-admin/properties",   icon: RiCommunityLine,           iconActive: RiCommunityFill,          color: "#8764B8" },
        { label: "Χρήστες",      href: "/super-admin/users",        icon: RiGroupLine,               iconActive: RiGroupFill,              color: "#0078D4" },
        { label: "Ρόλοι",        href: "/super-admin/roles",        icon: RiShieldUserLine,          iconActive: RiShieldUserFill,         color: "#E31E2A" },
      ],
    },
    {
      id: "financials", label: "Οικονομικά", icon: RiMoneyDollarCircleLine, color: "#107C10",
      items: [
        { label: "Υπηρεσίες",    href: "/super-admin/services",     icon: RiServiceLine,             iconActive: RiServiceFill,            color: "#CA5D00" },
        { label: "Κόστη API",    href: "/super-admin/settings/costs",      icon: RiMoneyDollarCircleLine,   iconActive: RiMoneyDollarCircleFill,  color: "#107C10" },
        { label: "Τιμολόγηση",   href: "/super-admin/billing",              icon: RiFileListLine,            iconActive: RiFileListFill,           color: "#CA5D00" },
      ],
    },
    {
      id: "settings", label: "Ρυθμίσεις", icon: RiSettingsLine, color: "#5C5C5C",
      items: [
        { label: "Εταιρία",      href: "/super-admin/settings/company",     icon: RiBuildingLine,            iconActive: RiBuildingFill,           color: "#8764B8" },
        { label: "Brand",        href: "/super-admin/settings/brand",       icon: RiPaletteLine,             iconActive: RiPaletteFill,            color: "#8764B8" },
        { label: "Ενσωματώσεις", href: "/super-admin/integrations",         icon: RiLinksLine,                iconActive: RiLinksFill,               color: "#038387" },
        { label: "Ρυθμίσεις",   href: "/super-admin/settings",             icon: RiSettingsLine,            iconActive: RiSettingsFill,           color: "#5C5C5C" },
      ],
    },
    {
      id: "cms", label: "CMS", icon: RiLayoutLine, color: "#8764b8",
      items: [
        { label: "Αρχική", href: "/super-admin/cms/landing", icon: RiLayoutLine, iconActive: RiLayoutFill, color: "#8764b8" },
      ],
    },
    {
      id: "preview", label: "Προεπισκόπηση", icon: RiEyeLine, color: "#038387",
      items: [
        { label: "View as…",     href: "/super-admin/view-as",      icon: RiEyeLine,                 iconActive: RiEyeFill,                color: "#038387" },
      ],
    },
  ],

  ADMIN: [
    {
      id: "core", label: "Κεντρικό", icon: RiDashboardLine, color: "#0078D4",
      items: [
        { label: "Dashboard",    href: "/admin",                    icon: RiDashboardLine,           iconActive: RiDashboardFill,          color: "#0078D4" },
        { label: "Αναφορές",     href: "/admin/reports",            icon: RiBarChartLine,            iconActive: RiBarChart2Fill,          color: "#107C10" },
      ],
    },
    {
      id: "properties", label: "Ακίνητα", icon: RiBuildingLine, color: "#8764B8",
      items: [
        { label: "Ακίνητα",      href: "/admin/properties",         icon: RiBuildingLine,            iconActive: RiBuildingFill,           color: "#8764B8" },
        { label: "Μονάδες",      href: "/admin/units",              icon: RiHome3Line,               iconActive: RiHome3Fill,              color: "#038387" },
      ],
    },
    {
      id: "people", label: "Άνθρωποι", icon: RiGroupLine, color: "#0078D4",
      items: [
        { label: "Χρήστες",      href: "/admin/users",              icon: RiGroupLine,               iconActive: RiGroupFill,              color: "#0078D4" },
        { label: "Ενοικιαστές",  href: "/admin/residents",          icon: RiUserLine,                iconActive: RiUserFill,               color: "#8764B8" },
      ],
    },
    {
      id: "operations", label: "Λειτουργίες", icon: RiToolsLine, color: "#CA5D00",
      items: [
        { label: "Συντηρήσεις",  href: "/admin/maintenance",        icon: RiToolsLine,               iconActive: RiToolsFill,              color: "#CA5D00" },
        { label: "Ανακοινώσεις", href: "/admin/announcements",      icon: RiNotification2Line,       iconActive: RiNotification2Fill,      color: "#0078D4" },
        { label: "Ημερολόγιο",   href: "/admin/calendar",           icon: RiCalendarLine,            iconActive: RiCalendarFill,           color: "#107C10" },
      ],
    },
    {
      id: "settings", label: "Ρυθμίσεις", icon: RiSettingsLine, color: "#5C5C5C",
      items: [
        { label: "Κόστη",       href: "/admin/costs",              icon: RiMoneyDollarCircleLine,   iconActive: RiMoneyDollarCircleFill,  color: "#107C10" },
        { label: "Ρυθμίσεις",   href: "/admin/settings",           icon: RiSettingsLine,            iconActive: RiSettingsFill,           color: "#5C5C5C" },
      ],
    },
  ],

  MANAGER: [
    {
      id: "core", label: "Κεντρικό", icon: RiDashboardLine, color: "#0078D4",
      items: [
        { label: "Dashboard",    href: "/manager",                  icon: RiDashboardLine,           iconActive: RiDashboardFill,          color: "#0078D4" },
      ],
    },
    {
      id: "properties", label: "Ακίνητα", icon: RiBuildingLine, color: "#8764B8",
      items: [
        { label: "Ακίνητά μου",  href: "/manager/properties",      icon: RiBuildingLine,            iconActive: RiBuildingFill,           color: "#8764B8" },
        { label: "Μονάδες",      href: "/manager/units",            icon: RiHome3Line,               iconActive: RiHome3Fill,              color: "#038387" },
      ],
    },
    {
      id: "operations", label: "Εργασίες", icon: RiToolsLine, color: "#CA5D00",
      items: [
        { label: "Συντηρήσεις",  href: "/manager/maintenance",     icon: RiToolsLine,               iconActive: RiToolsFill,              color: "#CA5D00" },
        { label: "Ανακοινώσεις", href: "/manager/announcements",   icon: RiNotification2Line,       iconActive: RiNotification2Fill,      color: "#0078D4" },
      ],
    },
  ],

  PROPERTY_ADMIN: [
    {
      id: "core", label: "Κεντρικό", icon: RiDashboardLine, color: "#0078D4",
      items: [
        { label: "Dashboard",    href: "/manager",                  icon: RiDashboardLine,           iconActive: RiDashboardFill,          color: "#0078D4" },
      ],
    },
    {
      id: "properties", label: "Ακίνητα", icon: RiBuildingLine, color: "#8764B8",
      items: [
        { label: "Ακίνητά μου",  href: "/manager/properties",      icon: RiBuildingLine,            iconActive: RiBuildingFill,           color: "#8764B8" },
        { label: "Μονάδες",      href: "/manager/units",            icon: RiHome3Line,               iconActive: RiHome3Fill,              color: "#038387" },
      ],
    },
    {
      id: "operations", label: "Εργασίες", icon: RiToolsLine, color: "#CA5D00",
      items: [
        { label: "Συντηρήσεις",  href: "/manager/maintenance",     icon: RiToolsLine,               iconActive: RiToolsFill,              color: "#CA5D00" },
        { label: "Ανακοινώσεις", href: "/manager/announcements",   icon: RiNotification2Line,       iconActive: RiNotification2Fill,      color: "#0078D4" },
      ],
    },
  ],

  EMPLOYEE: [
    {
      id: "core", label: "Κεντρικό", icon: RiDashboardLine, color: "#0078D4",
      items: [
        { label: "Dashboard",    href: "/staff",                    icon: RiDashboardLine,           iconActive: RiDashboardFill,          color: "#0078D4" },
      ],
    },
    {
      id: "tasks", label: "Εργασίες", icon: RiToolsLine, color: "#CA5D00",
      items: [
        { label: "Assigned",     href: "/staff/tasks",              icon: RiFileListLine,            iconActive: RiFileListFill,           color: "#CA5D00" },
        { label: "Συντηρήσεις",  href: "/staff/maintenance",        icon: RiToolsLine,               iconActive: RiToolsFill,              color: "#8764B8" },
      ],
    },
  ],

  COLLABORATOR: [
    {
      id: "core", label: "Κεντρικό", icon: RiDashboardLine, color: "#0078D4",
      items: [
        { label: "Dashboard",    href: "/staff",                    icon: RiDashboardLine,           iconActive: RiDashboardFill,          color: "#0078D4" },
      ],
    },
    {
      id: "tasks", label: "Εργασίες", icon: RiToolsLine, color: "#CA5D00",
      items: [
        { label: "Assigned",     href: "/staff/tasks",              icon: RiFileListLine,            iconActive: RiFileListFill,           color: "#CA5D00" },
        { label: "Συντηρήσεις",  href: "/staff/maintenance",        icon: RiToolsLine,               iconActive: RiToolsFill,              color: "#8764B8" },
      ],
    },
  ],

  PROPERTY_OWNER: [
    {
      id: "core", label: "Κεντρικό", icon: RiDashboardLine, color: "#0078D4",
      items: [
        { label: "Dashboard",    href: "/owner",                    icon: RiDashboardLine,           iconActive: RiDashboardFill,          color: "#0078D4" },
      ],
    },
    {
      id: "assets", label: "Ακίνητά μου", icon: RiHome3Line, color: "#8764B8",
      items: [
        { label: "Μονάδες",      href: "/owner/units",              icon: RiHome3Line,               iconActive: RiHome3Fill,              color: "#8764B8" },
        { label: "Έσοδα",        href: "/owner/income",             icon: RiMoneyDollarCircleLine,   iconActive: RiMoneyDollarCircleFill,  color: "#107C10" },
      ],
    },
  ],

  PROPERTY_RESIDENT: [
    {
      id: "core", label: "Κεντρικό", icon: RiDashboardLine, color: "#0078D4",
      items: [
        { label: "Dashboard",    href: "/portal",                   icon: RiDashboardLine,           iconActive: RiDashboardFill,          color: "#0078D4" },
      ],
    },
    {
      id: "services", label: "Υπηρεσίες", icon: RiToolsLine, color: "#CA5D00",
      items: [
        { label: "Αιτήσεις",     href: "/portal/requests",          icon: RiToolsLine,               iconActive: RiToolsFill,              color: "#CA5D00" },
        { label: "Ανακοινώσεις", href: "/portal/announcements",     icon: RiNotification2Line,       iconActive: RiNotification2Fill,      color: "#0078D4" },
      ],
    },
  ],

  PROPERTY_VIEWER: [
    {
      id: "core", label: "Κεντρικό", icon: RiDashboardLine, color: "#0078D4",
      items: [
        { label: "Dashboard",    href: "/portal",                   icon: RiDashboardLine,           iconActive: RiDashboardFill,          color: "#0078D4" },
        { label: "Ανακοινώσεις", href: "/portal/announcements",     icon: RiNotification2Line,       iconActive: RiNotification2Fill,      color: "#0078D4" },
      ],
    },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────
type Props = {
  role: UserRole;
  userName: string;
  userEmail: string;
  logoUrl?: string | null;
  logoSquareUrl?: string | null;
  companyName: string;
  onSignOut: () => void;
};

const STORAGE_COLLAPSED = "dg-sidebar-collapsed";
const STORAGE_GROUPS    = "dg-sidebar-groups";

export function SidebarNav({ role, userName, userEmail, logoUrl, logoSquareUrl, companyName, onSignOut }: Props) {
  const pathname   = usePathname();
  const navGroups  = NAV_BY_ROLE[role] ?? NAV_BY_ROLE["PROPERTY_RESIDENT"];

  const [collapsed,   setCollapsed]   = useState(false);
  const [openGroups,  setOpenGroups]  = useState<Record<string, boolean>>(
    () => Object.fromEntries(navGroups.map((g) => [g.id, true])),
  );

  useEffect(() => {
    const c = localStorage.getItem(STORAGE_COLLAPSED);
    if (c !== null) setCollapsed(c === "true");
    const g = localStorage.getItem(STORAGE_GROUPS);
    if (g) { try { setOpenGroups(JSON.parse(g)); } catch { /* ignore */ } }
  }, []);

  function toggleSidebar() {
    setCollapsed((v) => {
      localStorage.setItem(STORAGE_COLLAPSED, String(!v));
      return !v;
    });
  }

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_GROUPS, JSON.stringify(next));
      return next;
    });
  }

  function isActive(href: string): boolean {
    if (pathname === href) return true;
    if (href !== "/" && pathname.startsWith(href + "/")) return true;
    return false;
  }

  const initials  = (userName || userEmail || "?").charAt(0).toUpperCase();
  const roleLabel = role.replace(/_/g, " ");

  const fullLogo   = logoUrl        || null;
  const squareLogo = logoSquareUrl  || null;

  return (
    <aside style={{
      width: collapsed ? 64 : 240,
      minWidth: collapsed ? 64 : 240,
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#FFFFFF",
      borderRight: "1px solid var(--border)",
      transition: "width 220ms cubic-bezier(0.4,0,0.2,1), min-width 220ms cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden",
      position: "relative",
      flexShrink: 0,
      zIndex: 40,
      fontFamily: "var(--font-sans)",
    }}>

      {/* ── Logo row ─────────────────────────────────────────── */}
      <div style={{
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: collapsed ? "0 14px" : "0 16px 0 20px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0, gap: 8,
      }}>
        {!collapsed && (
          fullLogo
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={fullLogo} alt={companyName} style={{ height: 28, width: "auto", maxWidth: 160, objectFit: "contain", objectPosition: "left" }} />
            : <span style={{ fontSize: 15, fontWeight: 700, color: "var(--primary)", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {companyName}
              </span>
        )}
        {collapsed && (
          squareLogo
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={squareLogo} alt={companyName} style={{ height: 28, width: 28, objectFit: "contain", margin: "0 auto" }} />
            : <span style={{ fontSize: 18, fontWeight: 800, color: "var(--primary)", margin: "0 auto" }}>
                {companyName.charAt(0)}
              </span>
        )}
        {!collapsed && (
          <button onClick={toggleSidebar} style={iconBtnStyle} title="Σύμπτυξη">
            <RiMenuFoldLine size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={toggleSidebar} style={{ ...iconBtnStyle, margin: "12px auto 4px", display: "flex" }} title="Ανάπτυξη">
          <RiMenuUnfoldLine size={16} />
        </button>
      )}

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: collapsed ? "8px 8px" : "8px 10px",
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        {navGroups.map((group) => {
          const isOpen    = openGroups[group.id] ?? true;
          const anyActive = group.items.some((i) => isActive(i.href));

          if (collapsed) {
            return (
              <div key={group.id} style={{ marginBottom: 8 }}>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon   = active ? item.iconActive : item.icon;
                  return (
                    <Link key={item.href} href={item.href} title={item.label} style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 40, height: 40, borderRadius: 8, margin: "0 auto 2px",
                      color: active ? item.color : "#8A8A8A",
                      background: active ? `${item.color}14` : "transparent",
                      textDecoration: "none",
                      transition: "background 120ms, color 120ms",
                    }}>
                      <Icon size={18} />
                    </Link>
                  );
                })}
              </div>
            );
          }

          return (
            <div key={group.id} style={{ marginBottom: 4 }}>
              <button
                onClick={() => toggleGroup(group.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  width: "100%", padding: "5px 8px",
                  border: "none", background: "transparent",
                  cursor: "pointer", borderRadius: 6, marginBottom: 2,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F2F1")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: `${group.color}18`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <group.icon size={11} style={{ color: group.color }} />
                </span>
                <span style={{
                  flex: 1, textAlign: "left",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                  color: anyActive ? group.color : "#707070",
                  whiteSpace: "nowrap", overflow: "hidden", fontFamily: "var(--font-sans)",
                  textTransform: "uppercase",
                }}>
                  {group.label}
                </span>
                <RiArrowDownSLine size={13} style={{
                  flexShrink: 0, color: "#B3B3B3",
                  transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 200ms",
                }} />
              </button>

              <div style={{
                overflow: "hidden",
                maxHeight: isOpen ? `${group.items.length * 38}px` : "0px",
                transition: "max-height 220ms cubic-bezier(0.4,0,0.2,1)",
              }}>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon   = active ? item.iconActive : item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: "flex", alignItems: "center", gap: 9,
                        padding: "6px 8px 6px 10px",
                        borderRadius: 6, marginBottom: 1,
                        color: active ? item.color : "#292929",
                        background: active ? `${item.color}12` : "transparent",
                        textDecoration: "none",
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        fontFamily: "var(--font-sans)",
                        transition: "background 120ms, color 120ms",
                        whiteSpace: "nowrap", overflow: "hidden",
                        borderLeft: active ? `2px solid ${item.color}` : "2px solid transparent",
                      }}
                      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "#F3F2F1"; }}
                      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                    >
                      <Icon size={16} style={{ flexShrink: 0, color: item.color }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User block ────────────────────────────────────────── */}
      <div style={{
        borderTop: "1px solid var(--border)",
        padding: collapsed ? "12px 8px" : "12px 12px",
        display: "flex", alignItems: "center", gap: 10,
        flexShrink: 0,
        justifyContent: collapsed ? "center" : "flex-start",
        background: "#FAFAFA",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "#DEECF9", border: "1px solid #A3CEEE",
          color: "#005A9E",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>

        {!collapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#201F1E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userName || userEmail}
              </p>
              <p style={{ fontSize: 10, color: "#707070", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                {roleLabel}
              </p>
            </div>
            <button
              onClick={onSignOut}
              title="Έξοδος"
              style={{ ...iconBtnStyle, color: "#8A8A8A" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#A4262C"; (e.currentTarget as HTMLButtonElement).style.background = "#FEE7E6"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#8A8A8A"; (e.currentTarget as HTMLButtonElement).style.background = "#F3F2F1"; }}
            >
              <RiLogoutBoxRLine size={16} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 6,
  border: "none", background: "#F3F2F1", color: "#5C5C5C",
  cursor: "pointer", transition: "background 120ms, color 120ms",
  flexShrink: 0,
};
