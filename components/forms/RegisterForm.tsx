"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { registerUser } from "@/app/actions/auth";

type UserRole = "ADMIN" | "PROPERTY_OWNER" | "PROPERTY_RESIDENT";

export function RegisterForm() {
  const t = useTranslations();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    role: "PROPERTY_OWNER" as UserRole,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate
    if (formData.password !== formData.confirmPassword) {
      setError(t("auth.register.passwordMismatch"));
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError(t("auth.register.passwordTooShort"));
      setIsLoading(false);
      return;
    }

    try {
      const result = await registerUser(
        formData.email,
        formData.password,
        formData.name,
        formData.role
      );

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(t("errors.serverError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-center">{t("auth.register.title")}</h1>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.register.subtitle")}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("common.fullName")}</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.login.emailPlaceholder")}
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">{t("auth.register.accountType")}</Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value as UserRole })
              }
              disabled={isLoading}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROPERTY_OWNER">{t("auth.register.propertyOwner")}</SelectItem>
                <SelectItem value="PROPERTY_RESIDENT">{t("auth.register.resident")}</SelectItem>
                <SelectItem value="ADMIN">{t("auth.register.companyAdmin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("common.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("auth.login.passwordPlaceholder")}
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("common.confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t("auth.login.passwordPlaceholder")}
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("auth.register.submitButton")}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.register.alreadyHaveAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("auth.register.signInLink")}
          </Link>
        </p>
      </form>
    </div>
  );
}
