'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { homePathForRole } from '@/lib/surfaces';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

const NAV_LINKS = [
  { href: '/pricing', label: 'Τιμές' },
  { href: '/services', label: 'Υπηρεσίες' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Επικοινωνία' },
];

export function LandingHeader() {
  const { data: session } = useSession();

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{
        borderColor: 'rgba(27,28,26,.07)',
        background: 'rgba(244,242,234,.72)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      }}
    >
      <nav className="mx-auto flex h-[70px] max-w-[1200px] items-center justify-between px-5 sm:px-7">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/orithon/orithon-symbol-black.png" alt="Orithon" width={27} height={27} className="h-[27px] w-[27px] object-contain" />
          <span
            className="text-[21px] font-semibold text-[var(--foreground)]"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.16em' }}
          >
            ORITHON
          </span>
        </Link>

        {/* Center nav */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[14.5px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {session?.user ? (
            <Link
              href={homePathForRole((session.user as any).role)}
              className="inline-flex h-9 items-center rounded-[var(--radius-sm)] bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-btn)] transition hover:-translate-y-px hover:brightness-[1.12]"
            >
              Ο χώρος μου
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-[14.5px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] sm:inline"
              >
                Σύνδεση
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center rounded-[var(--radius-sm)] bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-btn)] transition hover:-translate-y-px hover:brightness-[1.12]"
              >
                Κλείσε demo
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
