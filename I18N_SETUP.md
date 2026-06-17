# Internationalization (i18n) Setup

## 📋 Overview

The application supports **Greek (Ελληνικά)** and **English** languages, with **Greek as the default language**.

- **Default Language**: Greek (el)
- **Supported Languages**: Greek (el), English (en)
- **Framework**: next-intl (Next.js 16+ compatible)
- **Routing**: Automatic locale detection and URL-based routing

---

## 📁 File Structure

```
├── i18n.ts                          # i18n configuration
├── middleware.ts                    # Combined auth + i18n middleware
├── middleware-intl.ts               # i18n middleware (reference)
├── messages/
│   ├── el.json                      # Greek translations
│   └── en.json                      # English translations
├── components/
│   └── LanguageSwitcher.tsx         # Language selector component
└── (auth)/                          # Auth pages with i18n support
    ├── login/page.tsx
    ├── register/page.tsx
    └── forgot-password/page.tsx
```

---

## 🌍 URL Routing

- **Greek (Default)**: `/login`, `/register`, `/property-admin`
  - No locale prefix for default language
  
- **English**: `/en/login`, `/en/register`, `/en/property-admin`
  - English URLs have `/en` prefix

### Examples:
- `http://localhost:3000/login` → Greek
- `http://localhost:3000/en/login` → English
- `http://localhost:3000/property-admin` → Greek
- `http://localhost:3000/en/property-admin` → English

---

## 🔄 Using Translations in Components

### Client Components
Use the `useTranslations()` hook from `next-intl`:

```tsx
"use client";

import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations();
  
  return (
    <h1>{t("auth.login.title")}</h1>
    <p>{t("auth.login.subtitle")}</p>
  );
}
```

### Server Components
```tsx
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations();
  
  return <h1>{t("common.appName")}</h1>;
}
```

---

## 📝 Translation Keys Structure

Translation keys are organized hierarchically:

```json
{
  "common": {
    "appName": "Property Management",
    "email": "Email"
  },
  "auth": {
    "login": {
      "title": "Sign In",
      "subtitle": "Enter your credentials..."
    }
  },
  "roles": {
    "ADMIN": "Administrator"
  }
}
```

---

## 🔤 Language Switcher Component

The `<LanguageSwitcher />` component allows users to switch languages:

```tsx
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Header() {
  return (
    <nav>
      <LanguageSwitcher />
    </nav>
  );
}
```

---

## ✅ Current Translations Included

### Common Strings
- App names, buttons, forms
- Generic UI text (Save, Cancel, Delete, etc.)

### Authentication
- Login form
- Registration form  
- Password reset flow
- Error messages

### Dashboard
- Menu items for all 9 roles
- Role-based navigation

### User Roles
- All 9 role types translated to Greek & English

### Validation & Errors
- Form validation messages
- Error page content
- Access denied messages

---

## 🚀 Adding New Translations

1. **Add the key** to `messages/el.json`:
   ```json
   {
     "features": {
       "newFeature": "Νέα δυνατότητα"
     }
   }
   ```

2. **Add the same key** to `messages/en.json`:
   ```json
   {
     "features": {
       "newFeature": "New Feature"
     }
   }
   ```

3. **Use in component**:
   ```tsx
   const t = useTranslations();
   <p>{t("features.newFeature")}</p>
   ```

---

## 🔧 Middleware Configuration

The middleware (`middleware.ts`) handles:
- **i18n routing**: Adds/removes locale prefix based on language
- **Authentication**: Protects routes based on user role
- **Locale detection**: Sets language based on URL prefix

### How It Works:
1. Request comes in with URL (e.g., `/login`)
2. i18n middleware checks for locale prefix
3. Auth middleware validates user permissions
4. Response goes out with appropriate language

---

## 📌 Translation Keys Reference

### Auth Keys
- `auth.login.*` - Login page translations
- `auth.register.*` - Registration page translations
- `auth.forgotPassword.*` - Password reset translations
- `auth.resetPassword.*` - New password setup translations

### Common Keys
- `common.appName`
- `common.email`, `common.password`
- `common.signIn`, `common.signUp`, `common.logout`

### Role Keys
- `roles.ADMIN`, `roles.MANAGER`, etc.

### Error Keys
- `errors.unauthorized`
- `errors.notFound`
- `errors.serverError`

---

## 🌐 Adding More Languages (Future)

To add another language (e.g., German):

1. Create `messages/de.json` with all keys
2. Update `i18n.ts`:
   ```ts
   export const locales = ["el", "en", "de"] as const;
   ```
3. Update `LanguageSwitcher.tsx`:
   ```ts
   const languageNames: Record<Locale, string> = {
     el: "Ελληνικά",
     en: "English",
     de: "Deutsch",
   };
   ```

---

## ✨ Features

✅ Greek as default language
✅ Automatic locale routing
✅ No locale prefix for default language
✅ Language switcher component
✅ Type-safe translations with TypeScript
✅ Server & client component support
✅ All auth forms translated
✅ Menu items translated for all 9 roles
✅ Error messages translated

---

## 📖 Resources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Internationalization Best Practices](https://next-intl-docs.vercel.app/docs/getting-started/app-router)

---

**Status**: ✅ Complete - Greek & English supported with Greek as default
