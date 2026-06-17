"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";
import { requestPasswordReset, resetPassword } from "@/app/actions/auth";
import { OTPVerificationForm } from "./OTPVerificationForm";

export function ForgotPasswordForm() {
  const t = useTranslations();
  const [step, setStep] = useState<"email" | "otp" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await requestPasswordReset(email);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setStep("otp");
      }
    } catch (err) {
      setError(t("errors.serverError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOTPSuccess(otpCode: string) {
    setOtp(otpCode);
    setStep("reset");
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const result = await resetPassword(email, otp, newPassword);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        // Redirect to login
        window.location.href = "/login?reset=success";
      }
    } catch (err) {
      setError(t("errors.serverError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendOTP() {
    return requestPasswordReset(email);
  }

  // Step 1: Email Entry
  if (step === "email") {
    return (
      <div className="w-full max-w-md mx-auto">
        <form onSubmit={handleEmailSubmit} className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-center">
              {t("auth.forgotPassword.title")}
            </h1>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.forgotPassword.subtitle")}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.login.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("auth.forgotPassword.submitButton")}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.forgotPassword.backToSignIn")}
            </Link>
          </div>
        </form>
      </div>
    );
  }

  // Step 2: OTP Verification
  if (step === "otp") {
    return (
      <OTPVerificationForm
        email={email}
        onSuccess={handleOTPSuccess}
        onResend={handleResendOTP}
        type="password-reset"
      />
    );
  }

  // Step 3: New Password
  if (step === "reset") {
    return (
      <div className="w-full max-w-md mx-auto">
        <form onSubmit={handleResetPassword} className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-center">
              {t("auth.resetPassword.title")}
            </h1>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.resetPassword.subtitle")}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.resetPassword.newPassword")}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t("auth.resetPassword.confirmNewPassword")}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("auth.resetPassword.submitButton")}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.forgotPassword.backToSignIn")}
            </Link>
          </div>
        </form>
      </div>
    );
  }

  return null;
}
