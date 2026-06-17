# OTP (One-Time Password) System Documentation

## 🔐 Overview

The application now uses **6-digit OTP codes** sent via email for secure password operations:
- **Password Reset** - When users forget their password
- **Password Change** - When users change their password while logged in

---

## 📋 How It Works

### Password Reset Flow

```
1. User clicks "Forgot Password"
   ↓
2. Enters email address
   ↓
3. System generates 6-digit OTP
   ↓
4. Email sent to user with OTP (10 minutes validity)
   ↓
5. User enters OTP code
   ↓
6. User creates new password
   ↓
7. Password updated & OTP deleted
```

### Password Change Flow (When Logged In)

```
1. User accesses "Change Password"
   ↓
2. Enters current password
   ↓
3. System generates 6-digit OTP
   ↓
4. Email sent to user with OTP (10 minutes validity)
   ↓
5. User enters OTP code
   ↓
6. User creates new password
   ↓
7. Password updated & OTP deleted
```

---

## 🛠️ Technical Implementation

### Core Files

#### **lib/otp.ts** - OTP Service
```typescript
// Generate OTP
const code = generateOTPCode(); // Returns "123456"

// Create OTP for user
const result = await createOTP({
  email: "user@example.com",
  type: "password-reset",
  expiresIn: 600 // 10 minutes
});

// Validate OTP
const validation = await validateOTP(
  "user@example.com",
  "123456",
  "password-reset"
);

// Delete OTP after use
await deleteOTP("user@example.com", "123456");

// Resend OTP (with rate limiting)
await resendOTP("user@example.com", "password-reset");
```

#### **lib/mailgun.ts** - Email Templates
```typescript
// OTP Email Templates
emailTemplates.passwordResetOTP(otp, expiresIn)
emailTemplates.passwordChangeOTP(otp, expiresIn)

// Send OTP Emails
await sendPasswordResetOTP("user@example.com", "123456", 10);
await sendPasswordChangeOTP("user@example.com", "123456", 10);
```

#### **app/actions/auth.ts** - Auth Actions
```typescript
// Request password reset (sends OTP)
await requestPasswordReset("user@example.com");

// Verify OTP for password reset
await verifyPasswordResetOTP("user@example.com", "123456");

// Reset password with OTP
await resetPassword("user@example.com", "123456", "newPassword");

// Change password (current user)
await changePassword(userId, "currentPassword", "newPassword");

// Confirm password change with OTP
await confirmPasswordChange(userId, "123456", "newPassword");
```

### Email Templates

#### Password Reset OTP (Greek/English)
```
Subject: Κωδικός επαναφοράς κωδικού πρόσβασης - 6 ψηφία

┌─────────────────────┐
│   123456            │  ← 6-digit code
└─────────────────────┘

Ισχύει για: 10 λεπτά
```

#### Password Change OTP (Greek/English)
```
Subject: Κωδικός αλλαγής κωδικού πρόσβασης - 6 ψηφία

┌─────────────────────┐
│   123456            │  ← 6-digit code
└─────────────────────┘

Ισχύει για: 10 λεπτά
```

---

## 🔒 Security Features

✅ **6-digit codes** - 1 million possible combinations
✅ **10-minute expiration** - Auto-delete after timeout
✅ **Rate limiting** - Cannot resend within 30 seconds
✅ **Email verification** - OTP linked to email address
✅ **Type validation** - Separate OTPs for reset vs change
✅ **Single use** - Deleted after successful use
✅ **No token exposure** - OTP in email only, never in URLs

---

## 📱 User Interface Components

### **OTPVerificationForm**
```tsx
<OTPVerificationForm
  email="user@example.com"
  onSuccess={(otp) => handleOTPVerification(otp)}
  onResend={() => resendOTP()}
  type="password-reset"
/>
```

Features:
- 6-digit input field (numeric only)
- Real-time resend countdown (30 seconds)
- Error messages
- Loading states

### **ForgotPasswordForm**
3-step flow:
1. **Email entry** → Generate OTP
2. **OTP verification** → Confirm code
3. **Password reset** → Set new password

---

## 🔄 Database Schema

Stored in `VerificationToken` model:

```prisma
model VerificationToken {
  id      String @id @default(cuid())
  email   String
  token   String @unique  // The 6-digit OTP code
  expires DateTime
  type    String // "password-reset" or "password-change"
  
  @@index([email])
  @@index([token])
}
```

---

## 📧 Email Configuration

### Mailgun Templates

**Password Reset OTP Email:**
- Color: Blue (#3b82f6)
- Subject: "Κωδικός επαναφοράς κωδικού πρόσβασης - 6 ψηφία"
- Valid for: 10 minutes

**Password Change OTP Email:**
- Color: Green (#10b981)
- Subject: "Κωδικός αλλαγής κωδικού πρόσβασης - 6 ψηφία"
- Valid for: 10 minutes

Both emails include:
- Clear OTP code display
- Expiration time
- Security warning
- Unsubscribe link

---

## 🛡️ Security Best Practices

### For Users
- ✅ Never share your OTP with anyone
- ✅ OTP is valid for 10 minutes only
- ✅ Request a new OTP if yours expires
- ✅ Check your spam folder for OTP email

### For Developers
- ✅ Always validate OTP server-side
- ✅ Delete OTP immediately after use
- ✅ Use HTTPS for all OTP operations
- ✅ Log OTP attempts for security audit
- ✅ Implement rate limiting on resend

---

## 🚀 Usage Examples

### Example 1: Password Reset
```typescript
// Step 1: Request password reset
const step1 = await requestPasswordReset("user@example.com");
// → Sends OTP to email

// Step 2: User enters OTP and new password
const step2 = await resetPassword(
  "user@example.com",
  "123456", // OTP from email
  "newPassword123"
);
// → Password updated, OTP deleted
```

### Example 2: Change Password (Logged In)
```typescript
// Step 1: Initiate password change
const step1 = await changePassword(
  userId,
  "currentPassword",
  "newPassword123"
);
// → Sends OTP to user's email

// Step 2: Confirm with OTP
const step2 = await confirmPasswordChange(
  userId,
  "123456", // OTP from email
  "newPassword123"
);
// → Password updated, OTP deleted
```

---

## ⚙️ Configuration

### OTP Settings
```typescript
// lib/otp.ts
const EXPIRATION_TIME = 600; // 10 minutes
const RESEND_COOLDOWN = 30;  // 30 seconds between resends
const OTP_LENGTH = 6;        // 6-digit code
```

### Email Settings
```typescript
// lib/env.ts
MAILGUN_DOMAIN=your-domain.mailgun.org
MAILGUN_API_KEY=your-api-key
MAILGUN_FROM_EMAIL=noreply@your-domain.mailgun.org
```

---

## 📊 Audit & Logging

OTP operations are tracked in database:
- Creation timestamp
- Email address
- OTP type
- Expiration time
- Deletion (after successful use)

For auditing:
```typescript
const otps = await db.verificationToken.findMany({
  where: {
    type: "password-reset",
    createdAt: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    }
  }
});
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| OTP not received | Check spam folder, resend after 30 seconds |
| OTP expired | Click "Resend OTP", new code sent immediately |
| Invalid OTP | Check code is correct, type carefully |
| Email mismatch | Use the email associated with your account |
| Rate limit | Wait 30 seconds before resending |

---

## ✅ Status

- ✅ OTP generation & validation
- ✅ Email sending via Mailgun
- ✅ Password reset flow
- ✅ Password change flow
- ✅ Rate limiting
- ✅ Expiration handling
- ✅ Greek & English support

---

**Last Updated**: 2026-06-17
**Version**: 1.0
**Status**: Production Ready
