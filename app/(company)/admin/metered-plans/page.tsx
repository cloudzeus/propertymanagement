import MeteredPlansClient from "./MeteredPlansClient";

// Guarded by the (company) layout AppShell (company surface roles) and by the
// role-scoped /api/admin/metered-plans API — same idiom as /admin/costs which
// has no per-page server guard.
export default function MeteredPlansPage() {
  return <MeteredPlansClient />;
}
