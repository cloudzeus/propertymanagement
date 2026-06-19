# SUPER_ADMIN Dashboard Documentation

## Overview
The SUPER_ADMIN dashboard is the central control panel for managing the entire PropertyPro system. It provides system-wide oversight, configuration, and administration capabilities.

---

## Dashboard Structure

### Route: `/super-admin`

**Layout:** `app/(dashboard)/super-admin/layout.tsx`
- Dark sidebar navigation with 6 main sections
- Sticky header with current date
- User profile info and logout button
- Responsive design (collapses on mobile)

**Main Dashboard:** `app/(dashboard)/super-admin/page.tsx`
- Key metrics cards (4 main stats)
- Quick action links
- Recent companies and users
- System status indicators

---

## Dashboard Pages

### 1. Main Dashboard `/super-admin`
**File:** `app/(dashboard)/super-admin/page.tsx`

**Displays:**
- **Total Companies** - Count of all tenant companies
- **Total Users** - Count of all users across system
- **Total Properties** - Count of properties managed
- **Monthly API Costs** - EUR cost for current month

**Features:**
- Quick action buttons to other sections
- Recent companies table (5 most recent)
- Recent users list (5 most recent)
- System status (Database, API Services, Auth)
- Help & documentation section

**Data Queries:**
- Companies count
- Users count
- Properties count
- API usage cost (aggregated for current month)

---

### 2. Companies Management `/super-admin/companies`
**File:** `app/(dashboard)/super-admin/companies/page.tsx`

**Displays:**
- List of all companies in a table format
- Company name and slug
- Subscription tier
- Status (ACTIVE, TRIAL, SUSPENDED, CANCELLED)
- User count
- Property count

**Columns:**
| Name | Tier | Status | Users | Properties | Actions |
|------|------|--------|-------|------------|---------|
| Test Company | PROFESSIONAL | TRIAL | 8 | 2 | Edit |

**Features:**
- Search/filter by name or status
- + New Company button
- Edit company details
- View company details (TBD)

---

### 3. AI Tools Configuration `/super-admin/ai-tools`
**File:** `app/(dashboard)/super-admin/ai-tools/page.tsx`

**Configured Services:**
1. **Deepseek**
   - Status: Configured
   - Usage: Text translation, property analysis
   - Endpoint: api.deepseek.com

2. **Google Gemini**
   - Status: Configured
   - Usage: Maintenance recommendations, summaries
   - Endpoint: generativelanguage.googleapis.com

**Features:**
- Configure button for each service
- API Keys & Credentials section
- Usage statistics (tokens, calls, cost)
- Deepseek usage card (This Month)
- Gemini usage card (This Month)

**Data Displayed:**
- Tokens Used
- API Calls Count
- Cost in EUR

---

### 4. Integrations `/super-admin/integrations`
**File:** `app/(dashboard)/super-admin/integrations/page.tsx`

**Integrated Services:**
1. **Mailgun** - Email notifications & OTP
2. **BunnyCDN** - File storage & CDN
3. **Deepseek API** - AI translations
4. **Google Gemini** - AI generation

**Features Per Integration:**
- Service name and description
- Connection status badge
- Configuration button
- Test button
- Integration health status

**Health Status:**
- Last checked timestamp
- Status indicator (Healthy/Warning/Error)

**Additional Features:**
- Integration health dashboard
- Webhook management section
- Add webhook button

---

### 5. System Settings `/super-admin/settings`
**File:** `app/(dashboard)/super-admin/settings/page.tsx`

**Sections:**

#### General Settings
- Application Name (text input)
- Support Email (email input)
- Default Language (select: Greek, English)
- Timezone (select: Europe/Athens, etc.)

#### Trial Settings
- Default Trial Duration in days (14)
- Trial Reminder days before expiry (3)

#### Feature Flags
- New User Registration (toggle)
- Maintenance Features (toggle)
- AI Features (toggle)

#### Data & Privacy
- Export System Data button
- View Privacy Policy button
- Delete Old Logs button

**Actions:**
- Save Changes button
- Cancel button

---

### 6. API Costs Dashboard `/super-admin/settings/costs`
**File:** `app/(dashboard)/super-admin/settings/costs/page.tsx`

**Displays:**
- Current month total costs
- Last 30 days total
- API breakdown (per service):
  - Mailgun
  - BunnyCDN
  - Deepseek
  - Gemini
- Monthly cost summary
- Cost progression chart

**Features:**
- Cost filtering by date range
- Per-API usage details
- Percentage breakdown
- Export to CSV/PDF (TBD)

---

## Navigation Structure

```
Sidebar Menu:
├── 📊 Dashboard → /super-admin
├── 🏢 Companies → /super-admin/companies
├── ⚡ AI Tools → /super-admin/ai-tools
├── 🔗 Integrations → /super-admin/integrations
├── 💰 API Costs → /super-admin/settings/costs
└── ⚙️ Settings → /super-admin/settings
```

---

## Components Used

### Layout Components
- **LogoutButton** - Sign out functionality
- Sidebar navigation with emoji icons
- Header with current date
- User profile card

### Page Components
- Stats cards (4-column grid)
- Data tables
- Status badges
- Toggle switches
- Form inputs

### Data Displays
- KPI cards
- Tables (companies, users)
- Status indicators
- Usage charts (TBD)

---

## Database Queries

### Dashboard Metrics
```typescript
// Total companies
db.company.count()

// Total users
db.user.count()

// Active companies
db.company.count({ where: { status: 'ACTIVE' } })

// Total properties
db.property.count()

// Monthly API costs
db.aPIUsageLog.aggregate({
  _sum: { totalCost: true },
  where: { createdAt: { gte: monthStart } }
})

// Recent companies
db.company.findMany({
  take: 5,
  orderBy: { createdAt: 'desc' },
  include: { _count: { select: { users: true, properties: true } } }
})

// Recent users
db.user.findMany({
  take: 5,
  orderBy: { createdAt: 'desc' }
})
```

### Companies Management
```typescript
db.company.findMany({
  orderBy: { createdAt: 'desc' },
  include: { _count: { select: { users: true, properties: true } } }
})
```

---

## Authorization

✅ **Only SUPER_ADMIN role can access** all these pages

**Middleware checks:**
```typescript
if (!session || session.user.role !== 'SUPER_ADMIN') {
  redirect('/auth/login');
}
```

---

## Styling

- **Dark sidebar:** bg-gray-900
- **White cards:** bg-white with shadow
- **Status badges:**
  - ACTIVE: bg-green-100 text-green-800
  - TRIAL: bg-blue-100 text-blue-800
  - Other: bg-gray-100 text-gray-800
- **Primary actions:** bg-blue-600 hover:bg-blue-700
- **Destructive actions:** bg-red-600 hover:bg-red-700

---

## Key Features

✅ **Real-time metrics** - Live counts from database
✅ **Integration status** - Health checks for external services
✅ **Cost tracking** - Monitor API spending
✅ **Company management** - Overview of all tenants
✅ **Configuration** - System-wide settings
✅ **User management** - Create/manage users
✅ **AI tools** - Configure LLM services
✅ **Security** - Role-based access control

---

## Planned Enhancements

- [ ] Search/filter for companies
- [ ] Company creation form
- [ ] User management interface
- [ ] Analytics dashboard
- [ ] System logs viewer
- [ ] Backup & restore functionality
- [ ] Performance monitoring
- [ ] Audit trail
- [ ] Export/import data
- [ ] Custom report builder

---

## Testing

### Test Account
```
Email: gkozyris@i4ria.com
Password: 1f1femsk
```

### Test Data
- Test Company: "Test Company"
- Test Users: 8 users (one for each other role)
- Test Companies: Can create more via dashboard

### Test Flows
1. Login as SUPER_ADMIN
2. Navigate through all dashboard sections
3. Verify metrics load correctly
4. Test quick action buttons
5. Check company list displays
6. Verify settings are editable

---

## File Structure

```
app/(dashboard)/super-admin/
├── layout.tsx              # Main layout with sidebar
├── page.tsx                # Dashboard page
├── companies/
│   └── page.tsx           # Companies management
├── ai-tools/
│   └── page.tsx           # AI tools configuration
├── integrations/
│   └── page.tsx           # Integrations management
└── settings/
    ├── page.tsx           # General settings
    └── costs/
        └── page.tsx       # API costs dashboard

components/
└── LogoutButton.tsx       # Logout button component
```

---

## Database Models Used

- **Company** - Company/tenant information
- **User** - User accounts
- **Property** - Buildings managed
- **APIUsageLog** - API cost tracking
- **PricingTier** - Subscription tiers
- **MenuConfig** - Navigation menu config

---

## Security Notes

- ✅ Role-based access control (SUPER_ADMIN only)
- ✅ API keys hidden/masked in UI
- ✅ Session-based authentication
- ✅ CSRF protection via Auth.js
- ✅ No sensitive data in logs

---

## Performance Considerations

- Database queries optimized with indexes
- Pagination for large lists (TBD)
- Caching for frequently accessed data (TBD)
- Lazy loading for charts (TBD)

---

## Next Steps

1. **Test login** with SUPER_ADMIN account
2. **Verify navigation** works correctly
3. **Check dashboard metrics** load properly
4. **Test company list** displays all companies
5. **Create additional test data** for full testing
6. **Develop remaining dashboards** for other roles

---

## Related Documentation

- `TEST_USERS_GUIDE.md` - Test accounts and dashboards
- `CMS_IMPLEMENTATION.md` - Public website setup
- `PRICING_MANAGEMENT_GUIDE.md` - Pricing configuration
- `CLAUDE.md` - Global project guidelines
