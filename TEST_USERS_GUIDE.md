# Test Users & Dashboards Guide

## Overview
The database seed now creates one test user for each of the 9 roles, along with a test company and menu configurations for each role. Use these accounts to develop and test dashboards.

---

## Test Users

### Credentials
**Password for all test users:** `password123`

### User List

| Role | Email | Name | Company |
|------|-------|------|---------|
| SUPER_ADMIN | gkozyris@i4ria.com | Super Administrator | (Global) |
| ADMIN | admin@test.com | Admin User | Test Company |
| MANAGER | manager@test.com | Manager User | Test Company |
| EMPLOYEE | employee@test.com | Employee User | Test Company |
| PROPERTY_ADMIN | property-admin@test.com | Property Admin | Test Company |
| PROPERTY_OWNER | property-owner@test.com | Property Owner | Test Company |
| PROPERTY_RESIDENT | property-resident@test.com | Property Resident | Test Company |
| PROPERTY_VIEWER | property-viewer@test.com | Property Viewer | Test Company |
| COLLABORATOR | collaborator@test.com | Collaborator User | Test Company |

---

## Dashboard Routes

Each role has a default dashboard and menu items. Create these pages to complete the implementation:

### 1. SUPER_ADMIN
**Email:** gkozyris@i4ria.com  
**Password:** 1f1femsk

**Menu Items:**
- Dashboard → `/super-admin`
- Companies → `/super-admin/companies`
- AI Tools → `/super-admin/ai-tools`
- Integrations → `/super-admin/integrations`
- API Costs → `/super-admin/settings/costs` ✅ (Already implemented)
- Settings → `/super-admin/settings`

**Pages to Create:**
- [ ] `/super-admin/page.tsx` - Dashboard
- [ ] `/super-admin/companies/page.tsx` - List all companies
- [ ] `/super-admin/ai-tools/page.tsx` - AI services management
- [ ] `/super-admin/integrations/page.tsx` - Integration settings
- [ ] `/super-admin/settings/page.tsx` - General settings

---

### 2. ADMIN
**Email:** admin@test.com  
**Password:** password123

**Menu Items:**
- Dashboard → `/admin`
- Companies → `/admin/companies`
- Users → `/admin/users`
- Settings → `/admin/settings`

**Pages to Create:**
- [ ] `/admin/page.tsx` - Dashboard
- [ ] `/admin/companies/page.tsx` - Manage company
- [ ] `/admin/users/page.tsx` - Manage users
- [ ] `/admin/settings/page.tsx` - Admin settings

---

### 3. MANAGER
**Email:** manager@test.com  
**Password:** password123

**Menu Items:**
- Dashboard → `/manager`
- Teams → `/manager/teams`
- Reports → `/manager/reports`

**Pages to Create:**
- [ ] `/manager/page.tsx` - Dashboard
- [ ] `/manager/teams/page.tsx` - Team management
- [ ] `/manager/reports/page.tsx` - Team reports

---

### 4. EMPLOYEE
**Email:** employee@test.com  
**Password:** password123

**Menu Items:**
- Dashboard → `/employee`
- Tasks → `/employee/tasks`

**Pages to Create:**
- [ ] `/employee/page.tsx` - Dashboard
- [ ] `/employee/tasks/page.tsx` - Assigned tasks

---

### 5. PROPERTY_ADMIN
**Email:** property-admin@test.com  
**Password:** password123

**Menu Items:**
- Dashboard → `/property-admin`
- Properties → `/property-admin/properties`
- Units → `/property-admin/units`
- Residents → `/property-admin/residents`
- Maintenance → `/property-admin/maintenance`

**Pages to Create:**
- [ ] `/property-admin/page.tsx` - Dashboard
- [ ] `/property-admin/properties/page.tsx` - Manage properties
- [ ] `/property-admin/units/page.tsx` - Manage units
- [ ] `/property-admin/residents/page.tsx` - Manage residents
- [ ] `/property-admin/maintenance/page.tsx` - Maintenance requests

---

### 6. PROPERTY_OWNER
**Email:** property-owner@test.com  
**Password:** password123

**Menu Items:**
- Dashboard → `/property-owner`
- My Properties → `/property-owner/properties`
- Billing → `/property-owner/billing`

**Pages to Create:**
- [ ] `/property-owner/page.tsx` - Dashboard
- [ ] `/property-owner/properties/page.tsx` - Owned properties
- [ ] `/property-owner/billing/page.tsx` - Billing info

---

### 7. PROPERTY_RESIDENT
**Email:** property-resident@test.com  
**Password:** password123

**Menu Items:**
- Announcements → `/property-resident/announcements`
- Billing → `/property-resident/billing`
- Maintenance → `/property-resident/maintenance`

**Pages to Create:**
- [ ] `/property-resident/announcements/page.tsx` - View announcements
- [ ] `/property-resident/billing/page.tsx` - View billing
- [ ] `/property-resident/maintenance/page.tsx` - Submit/view maintenance

---

### 8. PROPERTY_VIEWER
**Email:** property-viewer@test.com  
**Password:** password123

**Menu Items:**
- Announcements → `/property-viewer/announcements`

**Pages to Create:**
- [ ] `/property-viewer/announcements/page.tsx` - View public announcements

---

### 9. COLLABORATOR
**Email:** collaborator@test.com  
**Password:** password123

**Menu Items:**
- Dashboard → `/collaborator`
- Assigned Tasks → `/collaborator/tasks`

**Pages to Create:**
- [ ] `/collaborator/page.tsx` - Dashboard
- [ ] `/collaborator/tasks/page.tsx` - View assigned tasks

---

## Test Company

**Name:** Test Company  
**Slug:** test-company  
**Status:** TRIAL (14 days remaining)  
**Subscription Tier:** PROFESSIONAL  
**Limits:**
- Max Properties: 10
- Max Users: 50
- Max Storage: 100 GB

---

## Quick Start

### 1. Run the Seed
```bash
npm run db:seed
# or
npx prisma db:seed
```

### 2. Test Login
```
Email: admin@test.com
Password: password123
```

Expected redirect: `/admin` dashboard

### 3. Create Dashboard Pages
Choose a role and create the dashboard page:

**Example for ADMIN role:**
```typescript
// app/admin/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>
      <p className="text-gray-600">Welcome, {session?.user?.name}!</p>
      
      {/* Add dashboard content here */}
    </div>
  );
}
```

---

## Database Schema References

### Users Table
```typescript
{
  email: string
  name: string
  role: UserRole  // ADMIN, MANAGER, etc.
  status: UserStatus  // ACTIVE, INACTIVE, SUSPENDED
  companyId: string  // FK to Company (null for SUPER_ADMIN)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Company Table
```typescript
{
  name: string
  slug: string (unique)
  subscriptionTier: SubscriptionTier  // STARTER, PROFESSIONAL, ENTERPRISE
  status: CompanyStatus  // ACTIVE, TRIAL, SUSPENDED, CANCELLED
  maxProperties: number
  maxUsers: number
  maxStorage: number (GB)
  trialEndsAt: DateTime?
  createdAt: DateTime
  updatedAt: DateTime
}
```

### MenuConfig Table
```typescript
{
  role: UserRole
  menuItems: MenuItem[]  // Array of navigation items
  isDefault: boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

---

## Testing Workflow

### 1. Test Role-Based Access
1. Login as each user
2. Verify dashboard redirects are correct
3. Check menu items match role
4. Verify unauthorized access is blocked

### 2. Test Role Permissions
Each role should only see/do what's appropriate:
- SUPER_ADMIN: Can manage everything globally
- ADMIN: Can manage company settings
- MANAGER: Can manage teams within company
- EMPLOYEE: Can only see assigned tasks
- PROPERTY_ADMIN: Can manage specific properties
- PROPERTY_OWNER: Can view owned properties only
- PROPERTY_RESIDENT: Can view announcements and submit maintenance
- PROPERTY_VIEWER: Can only view announcements
- COLLABORATOR: Can view assigned tasks only

### 3. Create Test Data
Once dashboards are created, add test data:
- [ ] Create test properties
- [ ] Create test units
- [ ] Create test maintenance requests
- [ ] Create test announcements
- [ ] Create test billing records

---

## Debugging Tips

### Check User Role
```typescript
const { data: session } = useSession();
console.log(session?.user?.role);  // Should match one of 9 roles
```

### Check Menu Items
```typescript
// In your layout or navigation component
const { data: session } = useSession();
// Query MenuConfig where role = session.user.role
```

### Verify Company Association
```typescript
// Only non-SUPER_ADMIN users should have companyId
const { data: session } = useSession();
console.log(session?.user?.companyId);  // Should be set for all test users
```

### Reset Test Data
To start fresh:
```bash
npx prisma db:push --skip-generate --force-reset
npm run db:seed
```

---

## Security Notes

⚠️ **These are test accounts only!**

- [ ] Change all test passwords before production
- [ ] Delete test users in production
- [ ] Delete test company in production
- [ ] Never commit real credentials to git
- [ ] Use environment variables for real credentials

---

## Next Steps

1. **Pick a role** to start with (recommend ADMIN)
2. **Create the dashboard page** at the designated route
3. **Test the redirect** by logging in with that role
4. **Move to next role** and repeat
5. **Add navigation** to link between pages
6. **Add data displays** (lists, forms, charts, etc.)

---

## Menu Configuration Structure

```typescript
interface MenuItem {
  id: string;           // Unique identifier
  label: string;        // Display name
  icon: string;         // Icon name (lucide-react)
  href: string;         // Route path
  children?: MenuItem[]; // Nested menu items (for future)
}
```

Example:
```typescript
{
  id: "dashboard",
  label: "Dashboard",
  icon: "home",
  href: "/admin"
}
```

---

## Common Routes Pattern

All role dashboards follow the pattern:
```
/[role-slug]/              - Main dashboard
/[role-slug]/[feature]/    - Feature pages
/[role-slug]/[feature]/[id] - Detail pages
```

Example paths:
- `/admin/users` - List users
- `/admin/users/123` - User details
- `/property-admin/properties` - List properties
- `/property-admin/properties/abc/units` - Units in property

---

## Testing All 9 Roles

Use this checklist to test each role:

- [ ] SUPER_ADMIN - gkozyris@i4ria.com / 1f1femsk
- [ ] ADMIN - admin@test.com / password123
- [ ] MANAGER - manager@test.com / password123
- [ ] EMPLOYEE - employee@test.com / password123
- [ ] PROPERTY_ADMIN - property-admin@test.com / password123
- [ ] PROPERTY_OWNER - property-owner@test.com / password123
- [ ] PROPERTY_RESIDENT - property-resident@test.com / password123
- [ ] PROPERTY_VIEWER - property-viewer@test.com / password123
- [ ] COLLABORATOR - collaborator@test.com / password123

Each should redirect to their respective dashboard on login.
