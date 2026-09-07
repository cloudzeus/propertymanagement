'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname } from '@/i18n/navigation';
import { RiMenuLine, RiCloseLine } from 'react-icons/ri';
import { homePathForRole } from '@/lib/surfaces';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { DemoModalHost } from '@/components/landing/DemoBookingModal';
import type { NavData } from '@/lib/cms/landing-types';

/** Handoff 02 §1 link set. `/news` is `/blog` in this app — the route already exists. */
const NAV_LINKS = [
  { href: '/#features', el: 'Δυνατότητες', en: 'Features' },
  { href: '/#calc', el: 'Κοστολόγιο', en: 'Calculator' },
  { href: '/pricing', el: 'Τιμές', en: 'Pricing' },
  { href: '/blog', el: 'Νέα', en: 'News' },
  { href: '/faq', el: 'FAQ', en: 'FAQ' },
  { href: '/contact', el: 'Επικοινωνία', en: 'Contact' },
];

const T = {
  el: { login: 'Σύνδεση', demo: 'Κλείσε demo', mine: 'Ο χώρος μου', menu: 'Μενού', close: 'Κλείσιμο' },
  en: { login: 'Log in', demo: 'Book a demo', mine: 'My workspace', menu: 'Menu', close: 'Close' },
};

/** Anchor links (`/#calc`) never count as the active route. */
function isActive(pathname: string, href: string) {
  if (href.includes('#')) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LandingHeaderClient({ nav }: { nav?: NavData | null }) {
  const { data: session } = useSession();
  const locale = useLocale() === 'en' ? 'en' : 'el';
  const pathname = usePathname();
  const t = T[locale];
  const [open, setOpen] = useState(false);

  // The drawer is a route-level overlay — a navigation must always dismiss it.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const links = nav?.links?.length
    ? nav.links.map((l) => ({ href: l.href, label: l.label }))
    : NAV_LINKS.map((l) => ({ href: l.href, label: l[locale] }));

  const demoHref = nav?.demoHref || '#demo';

  return (
    <header
      className="sticky top-0 z-[60] border-b"
      style={{
        borderColor: 'rgba(27,28,26,.07)',
        background: 'rgba(244,242,234,.72)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      }}
    >
      <nav className="mx-auto flex h-[70px] max-w-[1200px] items-center justify-between gap-6 px-5 sm:px-7">
        {/* Brand — flex:none, or the link row squeezes it (02 §1) */}
        <Link href="/" className="flex flex-none items-center gap-[11px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/orithon/orithon-symbol-black.png" alt="Orithon" width={27} height={27} className="h-[27px] w-[27px] object-contain" />
          <span
            className="text-[length:var(--fs-21)] font-semibold text-[var(--txt)]"
            /* padding-left optically corrects the tracking on the first letter */
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.16em', paddingLeft: '.06em' }}
          >
            ORITHON
          </span>
        </Link>

        {/* Links — hidden below 1080px, where brand + actions leave no room */}
        <div className="hidden items-center gap-[26px] min-[1080px]:flex">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href + link.label}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap text-[length:var(--fs-14-5)] transition-colors ${
                  active ? 'font-bold text-[var(--txt)]' : 'text-[var(--mut)] hover:text-[var(--txt)]'
                }`}
                /* inset so the underline never shifts layout */
                style={active ? { boxShadow: 'inset 0 -2px 0 var(--accent)' } : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-none items-center gap-[14px]">
          <LanguageSwitcher />
          {session?.user ? (
            <Link
              href={homePathForRole((session.user as any).role)}
              className="inline-flex items-center rounded-[10px] bg-[var(--ink-chip)] px-[17px] py-[10px] text-[length:var(--fs-14)] font-bold text-white shadow-[var(--shadow-btn)] transition-[transform,filter] duration-[180ms] hover:-translate-y-0.5 hover:brightness-[1.18]"
            >
              {nav?.mineLabel || t.mine}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-[length:var(--fs-14-5)] text-[var(--mut)] transition-colors hover:text-[var(--txt)] sm:inline"
              >
                {nav?.loginLabel || t.login}
              </Link>
              <Link
                href={demoHref}
                className="inline-flex items-center rounded-[10px] bg-[var(--ink-chip)] px-[17px] py-[10px] text-[length:var(--fs-14)] font-bold text-white shadow-[var(--shadow-btn)] transition-[transform,filter] duration-[180ms] hover:-translate-y-0.5 hover:brightness-[1.18]"
              >
                {nav?.demoLabel || t.demo}
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t.close : t.menu}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--line)] bg-white text-[var(--txt)] min-[1080px]:hidden"
          >
            {open ? <RiCloseLine size={20} /> : <RiMenuLine size={20} />}
          </button>
        </div>
      </nav>

      {/* Drawer — the breakpoint hides the links, so this is the only way through */}
      {open && (
        <div className="border-t border-[var(--line2)] bg-[rgba(244,242,234,.97)] min-[1080px]:hidden">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-5 py-4 sm:px-7">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-[44px] items-center rounded-[11px] px-3 text-[length:var(--fs-15)] ${
                    active ? 'bg-white font-bold text-[var(--txt)]' : 'text-[var(--mut)]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {!session?.user && (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center rounded-[11px] px-3 text-[length:var(--fs-15)] text-[var(--mut)] sm:hidden"
              >
                {nav?.loginLabel || t.login}
              </Link>
            )}
          </div>
        </div>
      )}
      <DemoModalHost />
    </header>
  );
}
