import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Δεν έχετε πρόσβαση" };

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="text-center">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-red-600">403</h1>
          <h2 className="text-3xl font-bold text-slate-900">Δεν έχετε πρόσβαση</h2>
          <p className="text-slate-600 max-w-md" style={{ lineHeight: 1.6 }}>
            Ο λογαριασμός σας δεν έχει δικαίωμα σε αυτή τη σελίδα. Αν πιστεύετε ότι πρόκειται για λάθος, επικοινωνήστε με την εταιρεία διαχείρισης ή τον διαχειριστή σας.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Button variant="default">Αρχική</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline">Σύνδεση ξανά</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
