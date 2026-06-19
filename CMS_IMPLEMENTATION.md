# CMS & Public Website Implementation Guide

## Overview
A complete CMS and public-facing website has been added to PropertyPro, featuring cookie consent management, contact forms, and comprehensive legal pages.

---

## Database Models

### 1. **CMSPage**
Static content pages (Privacy Policy, Terms of Service, Cookie Policy, etc.)

**Fields:**
- `slug` (unique) - URL-friendly identifier (e.g., 'privacy', 'terms')
- `title` - Page title
- `content` - Full page content (supports markdown)
- `metaDescription` - SEO meta description
- `metaKeywords` - SEO keywords
- `publishedAt` - Publication timestamp
- `status` - DRAFT, PUBLISHED, or ARCHIVED
- Timestamps: `createdAt`, `updatedAt`

**Indexes:** slug, status

---

### 2. **FAQ**
Frequently Asked Questions with category organization

**Fields:**
- `question` - FAQ question text
- `answer` - Detailed answer (supports markdown)
- `category` - general, billing, features, technical
- `order` - Display order (for sorting)
- `published` - Boolean flag to show/hide
- Timestamps: `createdAt`, `updatedAt`

**Indexes:** category, published, order

---

### 3. **PricingTier**
Configurable pricing plans

**Fields:**
- `name` - Tier name (STARTER, PROFESSIONAL, ENTERPRISE)
- `slug` (unique) - URL-friendly identifier
- `description` - Plan description
- `monthlyPrice` - Monthly price in EUR
- `annualPrice` - Annual price in EUR
- `features` - Array of feature strings
- `highlighted` - Boolean for featured tier (e.g., "Most Popular")
- `order` - Display order
- `published` - Show/hide tier
- Timestamps: `createdAt`, `updatedAt`

**Indexes:** slug, published, order

---

### 4. **ContactMessage**
Contact form submissions from the public website

**Fields:**
- `name` - Visitor name
- `email` - Visitor email
- `phone` - Phone number (optional)
- `subject` - Message subject
- `message` - Message content
- `status` - NEW, READ, RESPONDED, SPAM
- `ipAddress` - Visitor IP for tracking
- `userAgent` - Browser information
- Timestamps: `createdAt`, `updatedAt`

**Indexes:** email, status, createdAt

---

### 5. **CookieConsent**
Browser cookie preference tracking

**Fields:**
- `sessionId` (unique) - Browser session identifier
- `analytics` - Analytics cookies enabled
- `marketing` - Marketing cookies enabled
- `functional` - Functional cookies enabled
- `essential` - Always true (required for functionality)
- `consentedAt` - When consent was given
- `expiresAt` - Consent validity (12 months from creation)
- `ipAddress` - Visitor IP
- `userAgent` - Browser info
- Timestamps: `createdAt`, `updatedAt`

**Indexes:** sessionId, expiresAt

---

## Public Website Pages

### Navigation & Layout
- **Header** - Logo, navigation menu, Auth buttons
- **Footer** - Links to legal pages, social media, company info
- **Cookie Consent Modal** - Loads on first visit

### Pages Implemented

#### 1. **Home Page** (`/`)
- Hero section with CTA buttons
- Feature highlights (6 main features)
- Call-to-action section
- Links to Pricing and Contact

#### 2. **Pricing** (`/pricing`)
- Three pricing tiers (Starter, Professional, Enterprise)
- Feature comparison per tier
- FAQ about pricing
- CTA to start trial or contact sales

#### 3. **FAQ** (`/faq`)
- Categorized questions
- Expandable Q&A format
- Categories: General, Billing, Features, Security
- Support contact CTA

#### 4. **Contact** (`/contact`)
- Contact form (name, email, phone, subject, message)
- Contact info (email, phone, hours)
- Response time SLA
- Form submission to API

#### 5. **Privacy Policy** (`/privacy`)
- Comprehensive privacy policy
- Data collection & use disclosure
- Security measures
- Contact information

#### 6. **Terms of Service** (`/terms`)
- Legal terms and conditions
- Use limitations
- Disclaimer of warranties
- Governing law (Greece)

#### 7. **Cookie Policy** (`/cookie-policy`)
- Cookie types explained
- Cookie management instructions
- GDPR compliance
- Consent mechanism

---

## Cookie Consent Modal

### Features
**Simple View (Default)**
- Brief explanation of cookies
- "Reject All" button
- "Accept All" button
- "Learn more" link to detailed view

**Detailed View**
- Per-category cookie toggles:
  - Essential (disabled/always on)
  - Functional
  - Analytics
  - Marketing
- Save preferences
- Back button
- Links to privacy, cookie, and terms pages

### Functionality
- Generates browser session ID on first visit
- Stores preferences in localStorage
- Sends preferences to `/api/cookie-consent` for server-side tracking
- Preferences valid for 12 months
- IP and User-Agent captured for analytics
- Respects GDPR requirements

### Persistence
```javascript
// Browser-side
localStorage.setItem(`cookie-consent-${sessionId}`, 'true');
localStorage.setItem('cookie-preferences', JSON.stringify(prefs));

// Server-side
CookieConsent table stores:
- sessionId
- preference booleans
- consentedAt timestamp
- expiresAt (12 months later)
- ipAddress & userAgent
```

---

## API Endpoints

### POST `/api/cookie-consent`
Save user cookie preferences

**Request Body:**
```json
{
  "sessionId": "session-1234567890-abc",
  "analytics": true,
  "marketing": false,
  "functional": true,
  "essential": true
}
```

**Response:**
```json
{
  "success": true
}
```

**Notes:**
- Creates or updates preference record
- Captures IP and User-Agent automatically
- Sets expiration 12 months from now

---

### POST `/api/contact`
Submit contact form

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+30 210 123 4567",
  "subject": "Inquiry about Enterprise plan",
  "message": "I'd like to learn more about your enterprise offering..."
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "clh3f9x2w0001qz0g4p8m3p7a"
}
```

**Features:**
- Validates required fields (name, email, subject, message)
- Stores message in database with NEW status
- Sends confirmation email to visitor
- Captures visitor IP and User-Agent
- Returns message ID for tracking

---

## Component: CookieConsent

**Location:** `components/CookieConsent.tsx`

**Props:** None (reads from localStorage)

**State:**
- `isVisible` - Show/hide modal
- `showDetails` - Toggle simple/detailed view
- `preferences` - Cookie preference object

**Methods:**
- `getOrCreateSessionId()` - Browser session tracking
- `handleAcceptAll()` - Accept all cookies
- `handleRejectAll()` - Accept only essential
- `handleSavePreferences()` - Save custom selection
- `saveCookiePreferences()` - API call to save

**Styling:**
- Fixed position at bottom of viewport
- Dark background with white text
- Form elements with Tailwind styling
- Responsive on mobile and desktop
- z-index: 50 (above most content)

---

## Integration Points

### 1. **Root Layout** (`app/layout.tsx`)
```tsx
import { CookieConsent } from "@/components/CookieConsent";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
          <CookieConsent /> {/* Renders on all pages */}
        </SessionProvider>
      </body>
    </html>
  );
}
```

### 2. **Contact Form Integration**
Contact page automatically:
1. Submits to `/api/contact`
2. Stores in ContactMessage table
3. Sends confirmation email via Mailgun
4. Displays success/error feedback

### 3. **Cookie Tracking**
When users visit:
1. CookieConsent component checks localStorage
2. If not consented, modal appears
3. User selects preferences
4. Request sent to `/api/cookie-consent`
5. Record created in CookieConsent table with 12-month expiration

---

## Future Enhancements

### CMS Content Management
- Admin dashboard to edit pages, FAQs, pricing
- Content versioning
- SEO optimization tools
- Preview before publishing

### Advanced Features
- Multi-language support for legal pages
- PDF download of policies
- Rich text editor for FAQ answers
- Image uploads for testimonials

### Analytics
- Track cookie consent statistics
- Monitor contact form submissions
- Visitor behavior analytics
- Conversion tracking

### Integrations
- Email notification to admin on new contacts
- Slack notifications for urgent inquiries
- Analytics tools (Google Analytics, Mixpanel)
- CRM integration for lead management

---

## Migration Status

✅ Migration `20260617123641_add_cms_models` applied successfully

All tables created:
- `CMSPage`
- `FAQ`
- `PricingTier`
- `ContactMessage`
- `CookieConsent`

---

## Testing Checklist

- [ ] Cookie consent modal appears on first visit
- [ ] Simple view displays correctly
- [ ] "Learn more" expands to detailed view
- [ ] Preferences save to localStorage and database
- [ ] Consent expires correctly (12 months)
- [ ] Contact form validates input
- [ ] Contact form submits and sends email
- [ ] All legal pages load without errors
- [ ] Navigation works on all pages
- [ ] Mobile responsiveness works
- [ ] Links to legal pages work correctly

---

## Environment Variables Required

No additional env vars needed (uses existing Mailgun setup for confirmations).

---

## Documentation Links

- Privacy Policy: `https://yoursite.com/privacy`
- Terms of Service: `https://yoursite.com/terms`
- Cookie Policy: `https://yoursite.com/cookie-policy`
- Contact Form: `https://yoursite.com/contact`
