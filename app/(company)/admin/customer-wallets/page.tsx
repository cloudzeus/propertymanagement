import CustomerWalletsClient from "./CustomerWalletsClient";

// Guarded by the (company) layout AppShell (company surface roles) and by the
// role-scoped /api/admin/customer-wallets API — same idiom as /admin/metered-plans
// which has no per-page server guard.
export default function CustomerWalletsPage() {
  return <CustomerWalletsClient />;
}
