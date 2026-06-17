"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { VerificationToken } from "@prisma/client";
import { v4 as uuid } from "uuid";

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
      // Don't reveal if user exists
      return { success: true };
    }

    // Create verification token
    const token = uuid();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.verificationToken.create({
      data: {
        email,
        token,
        expires,
        type: "password-reset",
      },
    });

    // TODO: Send email with Mailgun
    // await sendPasswordResetEmail(email, token);

    return { success: true };
  } catch (error) {
    console.error("Password reset request error:", error);
    return { error: "Failed to request password reset" };
  }
}

export async function resetPassword(token: string, newPassword: string) {
  try {
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    if (
      !verificationToken ||
      verificationToken.expires < new Date() ||
      verificationToken.type !== "password-reset"
    ) {
      return { error: "Invalid or expired token" };
    }

    const user = await db.user.findUnique({
      where: { email: verificationToken.email },
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

    // Delete used token
    await db.verificationToken.delete({
      where: { id: verificationToken.id },
    });

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return { error: "Failed to reset password" };
  }
}
