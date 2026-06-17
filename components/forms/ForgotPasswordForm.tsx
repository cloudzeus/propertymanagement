"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";

export function ForgotPasswordForm() {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await requestPasswordReset(email);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setSubmitted(true);
        setEmail("");
      }
    } catch (err) {
      setError(t("errors.serverError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {submitted ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-center">{t("auth.forgotPassword.checkEmail")}</h1>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.forgotPassword.title")}
            </p>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {t("auth.forgotPassword.emailSent", { email })}
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">
                {t("auth.forgotPassword.backToSignIn")}
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-center">{t("auth.forgotPassword.title")}</h1>
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
      )}
    </div>
  );
}
