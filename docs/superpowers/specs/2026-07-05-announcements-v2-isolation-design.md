# Announcements v2 + Per-Customer Isolation — Design

Date: 2026-07-05
Status: Approved (brainstorming)

## Problem

The current announcements feature ([app/actions/announcements.ts](../../../app/actions/announcements.ts))
is scoped to a **single building** and enforces access with a raw `auth()` + role
check (`requireStaff`). This has two gaps:

1. **No multi-property targeting.** Company staff must be able to send one
   announcement to one *or more* properties/buildings/units at once.
2. **Isolation hole.** Because access uses raw role checks (not `lib/scope.ts`),
   a `PROPERTY_ADMIN` of customer A can address a building belonging to customer
   B. Customer data must never cross the `customerId` boundary.

Plus: announcements need **rich text** (already HTML), **per-announcement
personalized email** (merge fields + branded sender), and support for two
originator kinds:

- **Company staff** (`SUPER_ADMIN` / `ADMIN` / `MANAGER` / `EMPLOYEE`) → any
  customer/property (no isolation limit).
- **`PROPERTY_ADMIN`** (the building manager on the customer side) → strictly
  their own customer's owners/residents.

## Decisions (from brainstorming)

- **Targeting model:** hierarchical (property → building → unit), recipients
  computed via an `audience` filter (ALL / OWNERS / RESIDENTS / CUSTOM).
- **Personalized email:** merge fields in the body/subject **and** branded
  sender per customer.
- **Originators:** company staff + `PROPERTY_ADMIN`.
- **Scope of this spec:** the announcements vertical only. It *establishes and
  verifies* the isolation pattern end-to-end; a broad app-wide isolation audit
  is explicitly out of scope.
- The existing single-building `AnnouncementsPanel` **stays** as a quick path.

## Data model

### `Announcement` (modify)

- `buildingId` → **nullable** (kept for the single-building quick path).
- Add `customerId String?` — denormalized owning customer for isolation.
  `null` **only** when company staff broadcast across customers; otherwise the
  single owning customer. Indexed.
- Add `origin String` — `STAFF | MANAGER` (originator kind, for display).
- Add `emailSubject String?` — overrides the email subject (defaults to title).
- Add `emailPreview String?` — preheader/preview text.
- Add `senderName String?`, `senderReplyTo String?` — snapshot of the branded
  sender at send time (audit).

### `AnnouncementTarget` (new)

```
model AnnouncementTarget {
  id             String
  announcementId String
  announcement   Announcement @relation(...)
  scopeType      String   // PROPERTY | BUILDING | UNIT | USER
  scopeId        String
  @@index([announcementId])
  @@index([scopeType, scopeId])
}
```

Records the **intent** of who the announcement was addressed to (so we can
re-resolve / display "sent to Property X + Building Y"). Delivery + acknowledgment
remain in the existing `Announcement_User` rows (materialized at send).

**Isolation invariant:** every `AnnouncementTarget` of an announcement resolves
to a building/unit/user under `announcement.customerId`. The only exception is a
staff broadcast where `customerId = null`.

## Isolation (core)

Replace `requireStaff()` with `lib/scope.ts`:

- `getScope()` → `seesAllCustomers` (staff) vs `PROPERTY_ADMIN` pinned to their
  `customerId`.
- **Reads** (`listAnnouncements`, `listAnnouncementTargets`) filtered with
  `customerWhere(scope)` over `Announcement.customerId`.
- **Create:** each selected target (property/building/unit) is loaded and passed
  through `assertCustomer(scope, target.customerId)`.
  - `PROPERTY_ADMIN` → all targets must equal their `customerId`; the
    announcement's `customerId` is set to it.
  - Staff → may span customers; `customerId` = the common customer, or `null`
    if targets span more than one.
- **Recipient resolution** never leaks users of another customer (closes the
  known UserCombo global-search leak pattern for this vertical).

## Recipient resolution

`buildingPeople(buildingId)` is generalized to accept many buildings (resolved
from the property/building/unit targets). Then:

- `audience = ALL | OWNERS | RESIDENTS` filters the pooled people.
- `audience = CUSTOM` uses an explicit `recipientUserIds` list, validated to be
  within scope.
- Dedup by user id, materialize `Announcement_User` rows with ack tokens
  (existing mechanism).

## Email (personalization)

- Extend `EmailOptions` in [lib/mailgun.ts](../../../lib/mailgun.ts) with optional
  `from` (display-name override) and `replyTo`. The Mailgun `from` becomes
  `"{name} <verified-domain-email>"` — only the display name changes; the sending
  domain stays the verified one.
- **Branded sender per customer:** `from` display name = `Customer.name`,
  `replyTo` = `Customer.email` (fallback to defaults when absent).
- **Merge fields** substituted **per recipient** in subject + body:
  `{{name}}`, `{{building}}`, `{{property}}`, `{{unit}}`.
  (`{{balance}}` deferred — not always resolvable.)
- Subject override + hidden preheader div for preview text.

## UI

- Keep the building-level `AnnouncementsPanel` for the quick single-building path.
- New **multi-target composer**: hierarchical picker (property → building →
  unit) + audience + rich text editor + merge-field toolbar + subject/preview.
  Surfaces:
  - Company surface (staff) — send to any customer.
  - `PROPERTY_ADMIN` portal — scoped to their own customer.

## Testing

Unit tests for:

- `getScope` → `customerWhere` fragment.
- `assertCustomer` rejects cross-customer targets; `PROPERTY_ADMIN` cannot target
  another customer's building/property/unit.
- Recipient resolution dedup across multiple buildings.
- Merge-field substitution (subject + body, missing fields safe).

## Out of scope

- App-wide isolation audit of other features.
- `{{balance}}` merge field.
- Scheduled/queued delivery (announcements still send synchronously best-effort).
