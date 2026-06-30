"use server";

import { signOut } from "@/auth";
import { clearImpersonation } from "@/lib/impersonation";

export async function signOutAction() {
  // Clear any active impersonation overlay so a fresh login is never haunted
  // by a stale impersonation cookie (it survives the session cookie otherwise).
  await clearImpersonation();
  await signOut({ redirectTo: "/login" });
}
