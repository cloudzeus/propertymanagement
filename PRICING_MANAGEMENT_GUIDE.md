# Pricing Management Guide

## Overview
Pricing tiers are managed by SUPER_ADMIN and ADMIN users through the admin dashboard. The `/pricing` page automatically fetches and displays all published pricing tiers from the database.

---

## Database Model: PricingTier

**Location:** `prisma/schema.prisma`

**Fields:**
```typescript
{
  id: String (unique, CUID)
  name: String              // "Starter", "Professional", "Enterprise"
  slug: String (unique)     // "starter", "professional", "enterprise"
  description: String?      // Plan description
  monthlyPrice: Float?      // Monthly price in EUR (null = Custom pricing)
  annualPrice: Float?       // Annual price in EUR
  features: String[]        // Array of feature descriptions
  highlighted: Boolean      // Mark as "Most Popular" (max 1 per set)
  order: Int               // Display order (1, 2, 3...)
  published: Boolean       // Show/hide tier
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Indexes:** slug, published, order

---

## How It Works

### 1. **Pricing Page Display** (`/pricing`)
```typescript
// Fetches published tiers, ordered by display order
const tiers = await db.pricingTier.findMany({
  where: { published: true },    // Only show published tiers
  orderBy: { order: 'asc' },     // Display in order
});
```

### 2. **Dynamic Rendering**
- Each tier renders a card with name, price, features
- The `highlighted: true` tier gets special styling ("Most Popular" badge)
- CTA buttons auto-adjust (Enterprise = "Contact Sales", others = "Start Free Trial")
- Feature lists are dynamically rendered from the `features` array

### 3. **Status Control**
- Set `published: false` to hide a tier from the public page
- Draft tiers won't appear even if they exist in the database
- Perfect for A/B testing different pricing strategies

---

## Initial Seeding

Three pricing tiers are automatically created when the database is seeded:

**Starter**
- €29/month or €290/year
- 5 properties, 50 units, 10 team members
- Basic features
- Highlighted: No
- Order: 1

**Professional** ⭐
- €79/month or €790/year
- 20 properties, 500 units, 50 team members
- Advanced features + Analytics + API
- Highlighted: Yes (shows "MOST POPULAR" badge)
- Order: 2

**Enterprise**
- Custom pricing (monthlyPrice: null)
- Unlimited everything
- Dedicated support & integrations
- Highlighted: No
- Order: 3

---

## Future Admin Dashboard

### Planned Features (TODO)

**Pricing Management Interface** (`/super-admin/pricing` or `/admin/pricing`)

#### List View
- [ ] Table showing all pricing tiers
- [ ] Columns: Name, Slug, Monthly Price, Published, Order
- [ ] Edit/Delete/Duplicate buttons
- [ ] Drag-to-reorder for display order
- [ ] Bulk publish/unpublish

#### Edit Tier Form
- [ ] Name field
- [ ] Slug field (auto-generate from name)
- [ ] Description (rich text editor)
- [ ] Monthly Price (EUR)
- [ ] Annual Price (EUR) - auto-calculate discount
- [ ] Features list (add/remove/reorder)
- [ ] Highlight toggle (max 1 per set)
- [ ] Published toggle
- [ ] Display order
- [ ] Preview on right side (live update)

#### Create New Tier
- [ ] Form pre-filled with defaults
- [ ] Auto-slug generation
- [ ] Duplicate existing tier option

#### Delete Tier
- [ ] Confirmation dialog
- [ ] Warning if tier is published
- [ ] Option to keep in database but unpublish instead

#### Bulk Actions
- [ ] Select multiple tiers
- [ ] Publish/unpublish all selected
- [ ] Delete all selected
- [ ] Reorder by drag-and-drop

---

## Database Management (Manual)

### Create a Tier (Direct SQL)
```sql
INSERT INTO "PricingTier" (
  id, name, slug, description, 
  "monthlyPrice", "annualPrice", features, 
  highlighted, "order", published, 
  "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Starter',
  'starter',
  'Perfect for small teams',
  29.00,
  290.00,
  '["Feature 1", "Feature 2", "Feature 3"]'::text[],
  false,
  1,
  true,
  NOW(),
  NOW()
);
```

### Update a Tier
```sql
UPDATE "PricingTier" 
SET 
  "monthlyPrice" = 39.00,
  "annualPrice" = 390.00,
  "updatedAt" = NOW()
WHERE slug = 'starter';
```

### Hide a Tier
```sql
UPDATE "PricingTier" 
SET published = false
WHERE slug = 'enterprise';
```

### Highlight a Tier
```sql
-- Unhighlight all
UPDATE "PricingTier" SET highlighted = false;

-- Highlight Professional
UPDATE "PricingTier" 
SET highlighted = true, "updatedAt" = NOW()
WHERE slug = 'professional';
```

### Delete a Tier
```sql
DELETE FROM "PricingTier" WHERE slug = 'enterprise';
```

---

## Programmatic Management (API Routes - Future)

### Planned API Endpoints

```typescript
// Get all tiers (published only)
GET /api/admin/pricing?published=true

// Get all tiers (admin view, include drafts)
GET /api/admin/pricing?all=true

// Create tier
POST /api/admin/pricing
{
  name: "Growth",
  slug: "growth",
  monthlyPrice: 49,
  annualPrice: 490,
  features: ["Feature 1", "Feature 2"],
  published: true
}

// Update tier
PUT /api/admin/pricing/:id
{
  monthlyPrice: 59,
  annualPrice: 590
}

// Delete tier
DELETE /api/admin/pricing/:id

// Reorder tiers
POST /api/admin/pricing/reorder
{
  tiers: [
    { id: "...", order: 1 },
    { id: "...", order: 2 },
    { id: "...", order: 3 }
  ]
}
```

---

## Best Practices

### 1. **Naming Convention**
- Use clear, marketing-friendly names: "Starter", "Professional", "Enterprise"
- Keep slugs lowercase with hyphens: "starter", "pro", "enterprise"
- Avoid numbers in slugs (makes renaming harder)

### 2. **Pricing Strategy**
- Always include annual pricing (typically 14-17% discount)
- Use whole or .99 numbers (€29, €99, €199)
- Enterprise should be null (Custom) not a specific number

### 3. **Features List**
- 8-12 features per tier (max)
- Start each with action verb or noun
- Keep language consistent across tiers
- Highlight 3-5 key differentiators per tier

### 4. **Display Order**
- Order: 1 = Leftmost
- Order: 2 = Center (usually highlighted)
- Order: 3 = Rightmost
- Don't use 0 or negative numbers

### 5. **Highlight Toggle**
- Only one tier should have `highlighted: true` at a time
- Admin dashboard should enforce this
- Highlighted tier gets 10% scale boost + border highlight

### 6. **Publishing**
- Test new tiers with `published: false` first
- Use bulk operations to update multiple tiers at once
- Keep old tiers for historical data (don't delete, just unpublish)

---

## Testing Checklist

- [ ] Pricing page displays published tiers
- [ ] Tiers display in correct order
- [ ] Highlighted tier has special styling
- [ ] Features list renders correctly
- [ ] Monthly/annual pricing displays
- [ ] Enterprise shows "Custom" pricing
- [ ] CTA buttons have correct links
- [ ] Unpublished tiers don't appear
- [ ] Page handles 0 tiers gracefully
- [ ] Mobile responsive layout

---

## Related Files

- **Pricing Page:** `/app/pricing/page.tsx`
- **Database Schema:** `/prisma/schema.prisma` (PricingTier model)
- **Seed Script:** `/prisma/seed.js` (initializes 3 default tiers)
- **Admin Dashboard:** (TBD - will be created at `/super-admin/pricing`)

---

## FAQ

**Q: Can I have multiple highlighted tiers?**
A: Technically yes, but the UI only shows one "MOST POPULAR" badge. Admin dashboard should prevent this.

**Q: What happens if I delete a tier?**
A: It's deleted from the database. Better to unpublish instead to keep historical records.

**Q: Can I change the slug after creation?**
A: Yes, but old URLs won't work. Add a redirect or keep the slug consistent.

**Q: How do I create a tier with no annual pricing?**
A: Set `annualPrice: null`. The page will only show monthly pricing.

**Q: Can features list be rich HTML?**
A: Currently strings only. To add rich formatting, change the `features` field to JSON and update rendering logic.

---

## Roadmap

- [ ] Admin dashboard for CRUD operations
- [ ] Drag-to-reorder interface
- [ ] Bulk publish/unpublish
- [ ] CSV import/export
- [ ] A/B testing interface
- [ ] Historical pricing tracking
- [ ] Pricing analytics (conversion rates per tier)
- [ ] Auto-currency conversion
- [ ] Volume discounts
