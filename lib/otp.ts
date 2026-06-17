import { db } from "./db";
import crypto from "crypto";

interface OTPOptions {
  email: string;
  type: "password-reset" | "password-change";
  expiresIn?: number; // seconds, default 10 minutes
}

interface OTPValidation {
  valid: boolean;
  error?: string;
}

/**
 * Generate a 6-digit OTP code
 */
export function generateOTPCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Create and store OTP for user
 */
export async function createOTP(options: OTPOptions) {
  try {
    const code = generateOTPCode();
    const expiresIn = options.expiresIn || 600; // 10 minutes default
    const expires = new Date(Date.now() + expiresIn * 1000);

    // Delete any existing OTP for this email
    await db.verificationToken.deleteMany({
      where: {
        email: options.email,
        type: options.type,
      },
    });

    // Create new OTP
    const token = await db.verificationToken.create({
      data: {
        email: options.email,
        token: code,
        expires,
        type: options.type,
      },
    });

    return {
      success: true,
      code,
      expiresAt: expires,
    };
  } catch (error) {
    console.error("OTP creation error:", error);
    return {
      success: false,
      error: "Failed to create OTP",
    };
  }
}

/**
 * Validate OTP code
 */
export async function validateOTP(
  email: string,
  code: string,
  type: "password-reset" | "password-change"
): Promise<OTPValidation> {
  try {
    const otp = await db.verificationToken.findUnique({
      where: {
        token: code,
      },
    });

    if (!otp) {
      return {
        valid: false,
        error: "Invalid OTP code",
      };
    }

    if (otp.email !== email) {
      return {
        valid: false,
        error: "OTP email mismatch",
      };
    }

    if (otp.type !== type) {
      return {
        valid: false,
        error: "OTP type mismatch",
      };
    }

    if (otp.expires < new Date()) {
      // Delete expired OTP
      await db.verificationToken.delete({
        where: { id: otp.id },
      });

      return {
        valid: false,
        error: "OTP code expired",
      };
    }

    return {
      valid: true,
    };
  } catch (error) {
    console.error("OTP validation error:", error);
    return {
      valid: false,
      error: "OTP validation failed",
    };
  }
}

/**
 * Delete OTP after successful use
 */
export async function deleteOTP(email: string, code: string): Promise<void> {
  try {
    await db.verificationToken.delete({
      where: { token: code },
    });
  } catch (error) {
    console.error("OTP deletion error:", error);
  }
}

/**
 * Get OTP expiration time remaining
 */
export async function getOTPExpiration(
  email: string,
  code: string
): Promise<number | null> {
  try {
    const otp = await db.verificationToken.findUnique({
      where: { token: code },
    });

    if (!otp || otp.email !== email) {
      return null;
    }

    const now = new Date();
    const remaining = Math.floor(
      (otp.expires.getTime() - now.getTime()) / 1000
    );

    return remaining > 0 ? remaining : null;
  } catch (error) {
    console.error("OTP expiration check error:", error);
    return null;
  }
}

/**
 * Resend OTP (create new one, delete old)
 */
export async function resendOTP(
  email: string,
  type: "password-reset" | "password-change"
) {
  try {
    // Check if OTP was created recently (avoid spam)
    const existingOTP = await db.verificationToken.findFirst({
      where: {
        email,
        type,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingOTP) {
      const timeSinceCreation =
        (Date.now() - existingOTP.createdAt.getTime()) / 1000;

      // Allow resend only after 30 seconds
      if (timeSinceCreation < 30) {
        return {
          success: false,
          error: `Please wait ${Math.ceil(30 - timeSinceCreation)} seconds before requesting a new code`,
          retryAfter: Math.ceil(30 - timeSinceCreation),
        };
      }
    }

    return createOTP({ email, type });
  } catch (error) {
    console.error("OTP resend error:", error);
    return {
      success: false,
      error: "Failed to resend OTP",
    };
  }
}
