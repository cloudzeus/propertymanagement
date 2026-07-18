'use client';

import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { homePathForRole } from '@/lib/surfaces';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { DemoModalHost } from '@/components/landing/DemoBookingModal';
import type { NavData } from '@/lib/cms/landing-types';

const NAV_LINKS = [
  { href: '/pricing', el: 'Τιμές', en: 'Pricing' },
  { href: '/services', el: 'Υπηρεσίες', en: 'Solutions' },
  { href: '/faq', el: 'FAQ', en: 'FAQ' },
  { href: '/contact', el: 'Επικοινωνία', en: 'Contact' },
];

const T = {
  el: { login: 'Σύνδεση', demo: 'Κλείσε demo', mine: 'Ο χώρος μου' },
  en: { login: 'Log in', demo: 'Book a demo', mine: 'My workspace' },
};

export function LandingHeaderClient({ nav }: { nav?: NavData | null }) {
  const { data: session } = useSession();
  const locale = useLocale() === 'en' ? 'en' : 'el';
  const t = T[locale];

  const links = nav?.links?.length
    ? nav.links.map((l) => ({ href: l.href, label: l.label }))
    : NAV_LINKS.map((l) => ({ href: l.href, label: l[locale] }));

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
          {links.map((link) => (
            <Link
              key={link.href + link.label}
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
              {nav?.mineLabel || t.mine}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-[14.5px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] sm:inline"
              >
                {nav?.loginLabel || t.login}
              </Link>
              <Link
                href={nav?.demoHref || '#demo'}
                className="inline-flex h-9 items-center rounded-[var(--radius-sm)] bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-btn)] transition hover:-translate-y-px hover:brightness-[1.12]"
              >
                {nav?.demoLabel || t.demo}
              </Link>
            </>
          )}
        </div>
      </nav>
      <DemoModalHost />
    </header>
  );
}
