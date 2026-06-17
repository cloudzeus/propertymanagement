"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface OTPVerificationFormProps {
  email: string;
  onSuccess: (otp: string) => void;
  onResend?: () => Promise<void>;
  type?: "password-reset" | "password-change";
}

export function OTPVerificationForm({
  email,
  onSuccess,
  onResend,
  type = "password-reset",
}: OTPVerificationFormProps) {
  const t = useTranslations();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError("OTP must be 6 digits");
      return;
    }

    setIsLoading(true);
    onSuccess(otp);
  };

  const handleResend = async () => {
    if (!onResend || resendCountdown > 0) return;

    setIsResending(true);
    try {
      await onResend();
      setResendCountdown(30);
      const interval = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-center">
            {type === "password-reset" ? "Enter OTP" : "Confirm Change"}
          </h1>
          <p className="text-center text-sm text-muted-foreground">
            We sent a 6-digit code to {email}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">One-Time Password</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setOtp(value.slice(0, 6));
              }}
              required
              disabled={isLoading}
              className="text-center text-2xl tracking-widest"
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify OTP
        </Button>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>Didn't receive the code?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || resendCountdown > 0}
            className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending
              ? "Sending..."
              : resendCountdown > 0
                ? `Resend in ${resendCountdown}s`
                : "Resend OTP"}
          </button>
        </div>
      </form>
    </div>
  );
}
