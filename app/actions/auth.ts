"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { v4 as uuid } from "uuid";
import { createOTP, validateOTP, deleteOTP } from "@/lib/otp";
import { sendPasswordResetOTP, sendPasswordChangeOTP } from "@/lib/mailgun";

export async function registerUser(
  email: string,
  password: string,
  name: string,
  role: "ADMIN" | "PROPERTY_OWNER" | "PROPERTY_RESIDENT"
) {
  try {
    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: "User already exists" };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash: hashedPassword,
        role,
        status: "ACTIVE",
      },
    });

    // Sign in the user
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    return { success: true, user };
  } catch (error) {
    console.error("Registration error:", error);
    return { error: "Failed to register user" };
  }
}

export async function requestPasswordReset(email: string) {
  try {
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists - still return success
      return { success: true };
    }

    // Create OTP
    const otpResult = await createOTP({
      email,
      type: "password-reset",
      expiresIn: 600, // 10 minutes
    });

    if (!otpResult.success) {
      return { error: "Failed to create OTP" };
    }

    // Send OTP email
    await sendPasswordResetOTP(email, otpResult.code, 10);

    return { success: true };
  } catch (error) {
    console.error("Password reset request error:", error);
    return { error: "Failed to request password reset" };
  }
}

export async function verifyPasswordResetOTP(email: string, otp: string) {
  try {
    const validation = await validateOTP(email, otp, "password-reset");

    if (!validation.valid) {
      return { error: validation.error };
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { error: "User not found" };
    }

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("OTP verification error:", error);
    return { error: "Failed to verify OTP" };
  }
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string
) {
  try {
    // Verify OTP
    const otpValidation = await validateOTP(email, otp, "password-reset");

    if (!otpValidation.valid) {
      return { error: otpValidation.error };
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { error: "User not found" };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    });

    // Delete used OTP
    await deleteOTP(email, otp);

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return { error: "Failed to reset password" };
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      return { error: "User not found" };
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!passwordMatch) {
      return { error: "Current password is incorrect" };
    }

    // Create OTP for password change
    const otpResult = await createOTP({
      email: user.email,
      type: "password-change",
      expiresIn: 600, // 10 minutes
    });

    if (!otpResult.success) {
      return { error: "Failed to create OTP" };
    }

    // Send OTP email
    await sendPasswordChangeOTP(user.email, otpResult.code, 10);

    return { success: true, message: "OTP sent to your email" };
  } catch (error) {
    console.error("Change password error:", error);
    return { error: "Failed to initiate password change" };
  }
}

export async function confirmPasswordChange(
  userId: string,
  otp: string,
  newPassword: string
) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { error: "User not found" };
    }

    // Verify OTP
    const otpValidation = await validateOTP(
      user.email,
      otp,
      "password-change"
    );

    if (!otpValidation.valid) {
      return { error: otpValidation.error };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    // Delete used OTP
    await deleteOTP(user.email, otp);

    return { success: true };
  } catch (error) {
    console.error("Confirm password change error:", error);
    return { error: "Failed to change password" };
  }
}
