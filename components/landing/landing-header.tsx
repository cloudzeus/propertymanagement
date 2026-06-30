'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { homePathForRole } from '@/lib/surfaces';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export function LandingHeader() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
          PropertyPro
        </Link>

        <div className="hidden gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-gray-700 transition hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex gap-3">
          {session?.user ? (
            <Link
              href={homePathForRole((session.user as any).role)}
              className="rounded-md px-4 py-2 font-medium text-white transition hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Μετάβαση στον χώρο μου
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-md px-4 py-2 font-medium text-white transition hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Δοκιμή
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
