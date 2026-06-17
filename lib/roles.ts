import { UserRole } from "@prisma/client";

export type Permission =
  | "read:dashboard"
  | "manage:users"
  | "manage:companies"
  | "manage:subscriptions"
  | "manage:properties"
  | "manage:units"
  | "manage:announcements"
  | "manage:maintenance"
  | "manage:teams"
  | "manage:tasks"
  | "manage:settings"
  | "manage:ai-tools"
  | "manage:integrations"
  | "view:reports"
  | "view:announcements"
  | "view:billing";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    "read:dashboard",
    "manage:users",
    "manage:companies",
    "manage:subscriptions",
    "manage:properties",
    "manage:units",
    "manage:announcements",
    "manage:maintenance",
    "manage:teams",
    "manage:tasks",
    "manage:settings",
    "manage:ai-tools",
    "manage:integrations",
    "view:reports",
  ],

  ADMIN: [
    "read:dashboard",
    "manage:users",
    "manage:companies",
    "manage:subscriptions",
    "manage:properties",
    "manage:units",
    "manage:announcements",
    "manage:maintenance",
    "manage:teams",
    "manage:tasks",
    "manage:settings",
    "view:reports",
  ],

  MANAGER: [
    "read:dashboard",
    "manage:teams",
    "manage:tasks",
    "manage:announcements",
    "manage:maintenance",
    "view:reports",
  ],

  EMPLOYEE: [
    "read:dashboard",
    "manage:tasks",
    "view:announcements",
  ],

  PROPERTY_ADMIN: [
    "read:dashboard",
    "manage:properties",
    "manage:units",
    "manage:announcements",
    "manage:maintenance",
    "view:reports",
  ],

  PROPERTY_OWNER: [
    "read:dashboard",
    "view:announcements",
    "view:billing",
  ],

  PROPERTY_RESIDENT: [
    "read:dashboard",
    "view:announcements",
    "view:billing",
  ],

  PROPERTY_VIEWER: [
    "view:announcements",
  ],

  COLLABORATOR: [
    "read:dashboard",
    "manage:tasks",
  ],
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Administrator - Full system access and configuration",
  ADMIN: "Administrator - Company management and user administration",
  MANAGER: "Manager - Team and task management",
  EMPLOYEE: "Employee - Task execution and reporting",
  PROPERTY_ADMIN: "Property Administrator - Building and unit management",
  PROPERTY_OWNER: "Property Owner - View announcements and billing",
  PROPERTY_RESIDENT: "Property Resident - View announcements and billing",
  PROPERTY_VIEWER: "Property Viewer - Digital signage display only",
  COLLABORATOR: "Collaborator - Task assignment and execution",
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRoleDisplayName(role: UserRole): string {
  const nameMap: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    MANAGER: "Manager",
    EMPLOYEE: "Employee",
    PROPERTY_ADMIN: "Property Admin",
    PROPERTY_OWNER: "Property Owner",
    PROPERTY_RESIDENT: "Resident",
    PROPERTY_VIEWER: "Viewer",
    COLLABORATOR: "Collaborator",
  };
  return nameMap[role];
}

// Default menu structure per role
export const DEFAULT_MENU_ITEMS: Record<UserRole, any[]> = {
  SUPER_ADMIN: [
    { id: "dashboard", label: "Dashboard", icon: "home", href: "/super-admin" },
    { id: "companies", label: "Companies", icon: "building", href: "/super-admin/companies" },
    { id: "ai-tools", label: "AI Tools", icon: "zap", href: "/super-admin/ai-tools" },
    { id: "integrations", label: "Integrations", icon: "link", href: "/super-admin/integrations" },
    { id: "settings", label: "Settings", icon: "settings", href: "/super-admin/settings" },
  ],
  ADMIN: [
    { id: "dashboard", label: "Dashboard", icon: "home", href: "/admin" },
    { id: "companies", label: "Companies", icon: "building", href: "/admin/companies" },
    { id: "users", label: "Users", icon: "users", href: "/admin/users" },
    { id: "subscriptions", label: "Subscriptions", icon: "credit-card", href: "/admin/subscriptions" },
    { id: "settings", label: "Settings", icon: "settings", href: "/admin/settings" },
  ],
  MANAGER: [
    { id: "dashboard", label: "Dashboard", icon: "home", href: "/manager" },
    { id: "teams", label: "Teams", icon: "users", href: "/manager/teams" },
    { id: "tasks", label: "Tasks", icon: "check-square", href: "/manager/tasks" },
    { id: "reports", label: "Reports", icon: "bar-chart", href: "/manager/reports" },
  ],
  EMPLOYEE: [
    { id: "dashboard", label: "Dashboard", icon: "home", href: "/employee" },
    { id: "tasks", label: "Tasks", icon: "check-square", href: "/employee/tasks" },
    { id: "announcements", label: "Announcements", icon: "bell", href: "/employee/announcements" },
  ],
  PROPERTY_ADMIN: [
    { id: "dashboard", label: "Dashboard", icon: "home", href: "/property-admin" },
    { id: "properties", label: "Properties", icon: "home", href: "/property-admin/properties" },
    { id: "units", label: "Units", icon: "layout", href: "/property-admin/units" },
    { id: "announcements", label: "Announcements", icon: "bell", href: "/property-admin/announcements" },
    { id: "maintenance", label: "Maintenance", icon: "tool", href: "/property-admin/maintenance" },
  ],
  PROPERTY_OWNER: [
    { id: "dashboard", label: "Dashboard", icon: "home", href: "/property-owner" },
    { id: "announcements", label: "Announcements", icon: "bell", href: "/property-owner/announcements" },
    { id: "billing", label: "Billing", icon: "credit-card", href: "/property-owner/billing" },
  ],
  PROPERTY_RESIDENT: [
    { id: "announcements", label: "Announcements", icon: "bell", href: "/property-resident/announcements" },
    { id: "billing", label: "Billing", icon: "credit-card", href: "/property-resident/billing" },
  ],
  PROPERTY_VIEWER: [
    { id: "announcements", label: "Announcements", icon: "bell", href: "/property-viewer/announcements" },
  ],
  COLLABORATOR: [
    { id: "tasks", label: "Tasks", icon: "check-square", href: "/collaborator/tasks" },
  ],
};
