# Database Seeding - SUPER_ADMIN User Setup

Due to Prisma client generation configuration, please create the SUPER_ADMIN user manually with these credentials:

## Credentials
- **Email**: gkozyris@i4ria.com
- **Password**: 1f1femsk (will be hashed with bcrypt)

## Seeding Methods

### Option 1: Using Prisma Studio (Recommended)
```bash
npm run db:studio
```

1. Open Prisma Studio in browser
2. Go to the `User` table
3. Click "Add record"
4. Fill in:
   - `email`: `gkozyris@i4ria.com`
   - `name`: `Super Administrator`
   - `passwordHash`: (use bcryptjs to hash "1f1femsk" - see below)
   - `role`: `SUPER_ADMIN`
   - `status`: `ACTIVE`

### Option 2: Generate Password Hash

To generate the bcryptjs hash for password "1f1femsk":

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('1f1femsk', 10, (err, hash) => { if (err) console.error(err); else console.log('Hashed password:', hash); });"
```

Then use the output hash in the passwordHash field.

### Option 3: Manual SQL (Direct Database)

If you have psql access:

```sql
INSERT INTO "User" (
  id, email, "name", "passwordHash", role, status, "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'gkozyris@i4ria.com',
  'Super Administrator',
  '$2a$10$...', -- Replace with bcrypt hash from Option 2
  'SUPER_ADMIN',
  'ACTIVE',
  NOW(),
  NOW()
);
```

---

## Features Ready

Once SUPER_ADMIN user is created, you can log in and access:

✅ **Translation Service** - Deepseek-powered translation (Greek → English)
  - Usage: `import { translateGreekToEnglish } from "@/lib/translate"`
  - Features: automatic caching, batch translation

✅ **OTP System** - One-time password authentication
  - Password reset via OTP email
  - Password change via OTP email

✅ **Database** - 16 models fully configured
  - PostgreSQL connection verified
  - Migrations applied

✅ **i18n** - Greek + English support
  - All forms translated
  - Language switcher

✅ **Integrations**
  - Mailgun for email
  - BunnyCDN for files
  - Deepseek API for translations
  - Gemini API for AI features

---

**Status**: ✅ All systems ready except SUPER_ADMIN seeding. Follow Option 1 or 2 above to complete setup.
