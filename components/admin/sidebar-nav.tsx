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
  RiSettings3Line, RiSettings3Fill,
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
  RiPagesLine, RiPagesFill,
  RiPriceTag3Line, RiPriceTag3Fill,
  RiQuestionLine, RiQuestionFill,
  RiImage2Line, RiImage2Fill,
  RiTranslate2,
  RiSearchEyeLine,
  RiArticleLine, RiArticleFill,
  RiUserStarLine, RiUserStarFill,
} from "react-icons/ri";
import type { MenuGroup } from "@/lib/rbac/permissions";

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

// ─── Icon lookup (registry icon-name string → component) ─────────────────────
const ICONS: Record<string, { line: React.ElementType; fill: React.ElementType }> = {
  RiDashboardLine:          { line: RiDashboardLine,          fill: RiDashboardFill },
  RiBarChartLine:           { line: RiBarChartLine,           fill: RiBarChart2Fill },
  RiRobot2Line:             { line: RiRobot2Line,             fill: RiRobot2Line },
  RiContactsLine:           { line: RiContactsLine,           fill: RiContactsFill },
  RiCommunityLine:          { line: RiCommunityLine,          fill: RiCommunityFill },
  RiHome3Line:              { line: RiHome3Line,              fill: RiHome3Fill },
  RiGroupLine:              { line: RiGroupLine,              fill: RiGroupFill },
  RiUserLine:               { line: RiUserLine,               fill: RiUserFill },
  RiShieldUserLine:         { line: RiShieldUserLine,         fill: RiShieldUserFill },
  RiServiceLine:            { line: RiServiceLine,            fill: RiServiceFill },
  RiMoneyDollarCircleLine:  { line: RiMoneyDollarCircleLine,  fill: RiMoneyDollarCircleFill },
  RiFileListLine:           { line: RiFileListLine,           fill: RiFileListFill },
  RiToolsLine:              { line: RiToolsLine,              fill: RiToolsFill },
  RiNotification2Line:      { line: RiNotification2Line,      fill: RiNotification2Fill },
  RiCalendarLine:           { line: RiCalendarLine,           fill: RiCalendarFill },
  RiLinksLine:              { line: RiLinksLine,              fill: RiLinksFill },
  RiBuildingLine:           { line: RiBuildingLine,           fill: RiBuildingFill },
  RiPaletteLine:            { line: RiPaletteLine,            fill: RiPaletteFill },
  RiSettingsLine:           { line: RiSettingsLine,           fill: RiSettingsFill },
  RiLayoutLine:             { line: RiLayoutLine,             fill: RiLayoutFill },
  RiSearchEyeLine:          { line: RiSearchEyeLine,          fill: RiSearchEyeLine },
  RiSettings3Line:          { line: RiSettings3Line,          fill: RiSettings3Fill },
  RiPagesLine:              { line: RiPagesLine,              fill: RiPagesFill },
  RiPriceTag3Line:          { line: RiPriceTag3Line,          fill: RiPriceTag3Fill },
  RiQuestionLine:           { line: RiQuestionLine,           fill: RiQuestionFill },
  RiArticleLine:            { line: RiArticleLine,            fill: RiArticleFill },
  RiUserStarLine:           { line: RiUserStarLine,           fill: RiUserStarFill },
  RiImage2Line:             { line: RiImage2Line,             fill: RiImage2Fill },
  RiTranslate2:             { line: RiTranslate2,             fill: RiTranslate2 },
  RiEyeLine:                { line: RiEyeLine,                fill: RiEyeFill },
};
const FALLBACK_ICON = { line: RiFileListLine, fill: RiFileListFill };

// ─── Group metadata (label, color, icon) keyed by group id ────────────────────
const GROUP_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  core:        { label: "Κεντρικό",        color: "#0078D4", icon: RiDashboardLine },
  management:  { label: "Διαχείριση",      color: "#8764B8", icon: RiBuildingLine },
  financials:  { label: "Οικονομικά",      color: "#107C10", icon: RiMoneyDollarCircleLine },
  settings:    { label: "Ρυθμίσεις",       color: "#5C5C5C", icon: RiSettingsLine },
  cms:         { label: "CMS",             color: "#8764b8", icon: RiLayoutLine },
  preview:     { label: "Προεπισκόπηση",   color: "#038387", icon: RiEyeLine },
  properties:  { label: "Ακίνητα",         color: "#8764B8", icon: RiBuildingLine },
  assets:      { label: "Ακίνητά μου",     color: "#8764B8", icon: RiHome3Line },
  services:    { label: "Υπηρεσίες",       color: "#CA5D00", icon: RiToolsLine },
  operations:  { label: "Εργασίες",        color: "#CA5D00", icon: RiToolsLine },
  tasks:       { label: "Εργασίες",        color: "#CA5D00", icon: RiToolsLine },
};
const FALLBACK_GROUP_META = { color: "#5C5C5C", icon: RiFileListLine };

function menuToNavGroups(menu: MenuGroup[]): NavGroup[] {
  return menu.map((g) => {
    const meta = GROUP_META[g.id];
    const color = meta?.color ?? FALLBACK_GROUP_META.color;
    return {
      id: g.id,
      label: meta?.label ?? g.id,
      icon: meta?.icon ?? FALLBACK_GROUP_META.icon,
      color,
      items: g.items.map((item) => {
        const icons = ICONS[item.icon] ?? FALLBACK_ICON;
        return {
          label: item.label,
          href: item.href,
          icon: icons.line,
          iconActive: icons.fill,
          color,
        };
      }),
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
type Props = {
  role: UserRole;
  menu: MenuGroup[];
  userName: string;
  userEmail: string;
  logoUrl?: string | null;
  logoSquareUrl?: string | null;
  companyName: string;
  onSignOut: () => void;
};

const STORAGE_COLLAPSED = "dg-sidebar-collapsed";
const STORAGE_GROUPS    = "dg-sidebar-groups";

export function SidebarNav({ role, menu, userName, userEmail, logoUrl, logoSquareUrl, companyName, onSignOut }: Props) {
  const pathname   = usePathname();
  const navGroups  = menuToNavGroups(menu);

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
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper)")}
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
                      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "var(--paper)"; }}
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
        background: "var(--paper)",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--card)", border: "1px solid var(--border)",
          color: "#005A9E",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>

        {!collapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userName || userEmail}
              </p>
              <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                {roleLabel}
              </p>
            </div>
            <button
              onClick={onSignOut}
              title="Έξοδος"
              style={{ ...iconBtnStyle, color: "var(--muted-foreground)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--destructive)"; (e.currentTarget as HTMLButtonElement).style.background = "color-mix(in oklab, var(--destructive) 10%, var(--card))"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--paper)"; }}
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
  border: "none", background: "var(--paper)", color: "var(--muted-foreground)",
  cursor: "pointer", transition: "background 120ms, color 120ms",
  flexShrink: 0,
};
