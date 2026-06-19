'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session) {
      // Redirect to appropriate dashboard based on role
      const role = (session.user as any)?.role;
      const redirectMap: Record<string, string> = {
        SUPER_ADMIN:       '/super-admin',
        ADMIN:             '/admin',
        MANAGER:           '/manager',
        PROPERTY_ADMIN:    '/manager',
        EMPLOYEE:          '/staff',
        COLLABORATOR:      '/staff',
        PROPERTY_OWNER:    '/owner',
        PROPERTY_RESIDENT: '/portal',
        PROPERTY_VIEWER:   '/portal',
      };

      const destination = redirectMap[role] || '/';
      router.push(destination);
    }
  }, [session, status, router]);

  // If authenticated, show loading while redirecting
  if (status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-pulse">
          <div className="h-12 w-12 bg-slate-300 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-pulse">
          <div className="h-12 w-12 bg-slate-300 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Show public home page for unauthenticated users
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            PropertyPro
          </Link>

          <div className="hidden md:flex gap-8">
            <Link href="/" className="text-gray-700 hover:text-blue-600 font-medium">
              Home
            </Link>
            <Link href="/pricing" className="text-gray-700 hover:text-blue-600 font-medium">
              Pricing
            </Link>
            <Link href="/faq" className="text-gray-700 hover:text-blue-600 font-medium">
              FAQ
            </Link>
            <Link href="/contact" className="text-gray-700 hover:text-blue-600 font-medium">
              Contact
            </Link>
          </div>

          <div className="flex gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 font-medium"
            >
              Login
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Manage Your Properties Effortlessly
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            The all-in-one platform for property managers to streamline operations, reduce costs, and improve tenant satisfaction.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/register"
              className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="px-8 py-3 border-2 border-white rounded-lg font-semibold hover:bg-blue-700"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-12">Powerful Features</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: '🏢', title: 'Property Management', desc: 'Manage multiple properties and units from a single dashboard.' },
              { icon: '📋', title: 'Maintenance Tracking', desc: 'Handle maintenance requests with real-time tracking and scheduling.' },
              { icon: '💰', title: 'Billing & Payments', desc: 'Automated billing, rent collection, and financial reporting.' },
              { icon: '📢', title: 'Announcements', desc: 'Share updates and digital signage with residents.' },
              { icon: '👥', title: 'Role-Based Access', desc: '9 different role types with customizable permissions.' },
              { icon: '🌐', title: 'Multi-Language', desc: 'Full support for Greek and English.' },
            ].map((feature, idx) => (
              <div key={idx} className="bg-white rounded-lg p-8 shadow-sm">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to transform your property management?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join hundreds of property managers who trust PropertyPro to streamline their operations.
          </p>
          <Link
            href="/auth/register"
            className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100"
          >
            Start Your Free Trial Today
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                <li><Link href="/cookie-policy" className="hover:text-white">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 PropertyPro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
