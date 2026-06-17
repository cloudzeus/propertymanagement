import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="text-center">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-red-600">403</h1>
          <h2 className="text-3xl font-bold text-slate-900">Access Denied</h2>
          <p className="text-slate-600 max-w-md">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
        </div>

        <div className="mt-8 space-x-4">
          <Link href="/">
            <Button variant="default">Go Home</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline">Sign In Again</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
