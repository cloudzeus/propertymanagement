"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, Shield, BarChart3, Users } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      // Redirect to appropriate dashboard based on role
      const role = (session.user as any)?.role;
      if (role === "SUPER_ADMIN") {
        router.push("/super-admin");
      } else if (role === "ADMIN") {
        router.push("/admin");
      } else if (role === "MANAGER") {
        router.push("/manager");
      } else if (role === "EMPLOYEE") {
        router.push("/employee");
      } else if (role === "PROPERTY_ADMIN") {
        router.push("/property-admin");
      } else if (role === "PROPERTY_OWNER") {
        router.push("/property-owner");
      } else if (role === "PROPERTY_RESIDENT") {
        router.push("/property-resident");
      } else if (role === "PROPERTY_VIEWER") {
        router.push("/property-viewer");
      } else if (role === "COLLABORATOR") {
        router.push("/collaborator");
      }
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-pulse">
          <div className="h-12 w-12 bg-slate-300 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <Building2 className="h-8 w-8 text-blue-600" />
              <span className="font-bold text-xl text-slate-900">Property Management</span>
            </div>
            <div className="space-x-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight">
            Professional Property <span className="text-blue-600">Management</span> Made Simple
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Streamline building operations, tenant management, and maintenance with our comprehensive SaaS platform designed for property managers and building owners.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/register">
              <Button size="lg" className="text-lg h-12 px-8">Start Free Trial</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg h-12 px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Building2 className="h-12 w-12 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">Property Management</h3>
            <p className="text-slate-600">Manage multiple properties and units from a single dashboard</p>
          </div>
          <div className="space-y-4">
            <Users className="h-12 w-12 text-green-600" />
            <h3 className="text-lg font-semibold text-slate-900">Tenant Portal</h3>
            <p className="text-slate-600">Residents view announcements and billing information easily</p>
          </div>
          <div className="space-y-4">
            <Shield className="h-12 w-12 text-purple-600" />
            <h3 className="text-lg font-semibold text-slate-900">Role-Based Access</h3>
            <p className="text-slate-600">Secure access control with 9 different user roles</p>
          </div>
          <div className="space-y-4">
            <BarChart3 className="h-12 w-12 text-orange-600" />
            <h3 className="text-lg font-semibold text-slate-900">Advanced Analytics</h3>
            <p className="text-slate-600">Track maintenance, expenses, and occupancy reports</p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-slate-200">
        <h2 className="text-3xl font-bold text-center mb-12">Simple, Per-Unit Pricing</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {["Starter", "Professional", "Enterprise"].map((tier) => (
            <div key={tier} className="bg-white rounded-lg border border-slate-200 p-8 space-y-6">
              <h3 className="text-xl font-semibold text-slate-900">{tier}</h3>
              <p className="text-slate-600">Billed per property unit (apartment, shop, parking)</p>
              <Link href="/register">
                <Button className="w-full">Get Started</Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
