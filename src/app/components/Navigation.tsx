'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { company, navItems } from '../data/site';
import { FINANCE_AUTH_EVENT, readFinanceToken } from '@/lib/finance-session-client';

const otherItems = [
  { name: 'Finance', href: '/finance' },
  { name: 'Personal', href: '/finance/personal' },
  { name: 'Agent', href: '/finance/agent' },
];

function isOtherItemActive(pathname: string, href: string) {
  if (href === '/finance/personal') return pathname.startsWith('/finance/personal');
  if (href === '/finance/agent') return pathname.startsWith('/finance/agent');
  return pathname === '/finance' || (pathname.startsWith('/finance/') && !pathname.startsWith('/finance/personal') && !pathname.startsWith('/finance/agent') && pathname !== '/finance/login' && !pathname.startsWith('/finance/verify'));
}

function publicNavItems() {
  return navItems.filter((item) => item.href !== '/contact');
}

function contactItem() {
  return navItems.find((item) => item.href === '/contact');
}

function isPublicActive(pathname: string, href: string) {
  if (href === '/#process') return false;
  return pathname === href || (href !== '/' && pathname.startsWith(href));
}

function isOtherActive(pathname: string) {
  return pathname.startsWith('/finance') && pathname !== '/finance/login' && !pathname.startsWith('/finance/verify');
}

function Logo() {
  return (
    <span className="flex items-center">
      <span className="text-lg font-extrabold tracking-tight text-slate-100">{company.name}</span>
    </span>
  );
}

function OtherDropdown({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = isOtherActive(pathname);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
          active ? 'bg-slate-950 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        Other
        <span aria-hidden="true" className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 min-w-44 rounded-xl border border-white/10 bg-[#0b1018]/96 p-1 shadow-xl shadow-black/30 backdrop-blur-xl"
        >
          {otherItems.map((item) => {
            const itemActive = isOtherItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                role="menuitem"
                href={item.href}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className={`block rounded-lg px-3 py-2 text-sm font-semibold ${
                  itemActive ? 'bg-cyan-300/12 text-cyan-200' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const isFinance = pathname.startsWith('/finance');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showOther, setShowOther] = useState(false);

  useEffect(() => {
    const syncAuth = () => setShowOther(Boolean(readFinanceToken()));
    syncAuth();
    window.addEventListener('storage', syncAuth);
    window.addEventListener(FINANCE_AUTH_EVENT, syncAuth);
    return () => {
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener(FINANCE_AUTH_EVENT, syncAuth);
    };
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const contact = contactItem();

  return (
    <header
      data-public-navigation
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'border-b border-white/8 bg-[#080c13]/88 shadow-lg shadow-black/10 backdrop-blur-xl'
          : 'bg-[#080c13]/45 backdrop-blur-sm'
      }`}
    >
      <nav className={`container-page flex items-center justify-between ${isFinance ? 'h-16 sm:h-20' : 'h-20'}`}>
        <Link href="/" aria-label={`${company.name} home`}>
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {publicNavItems().map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isPublicActive(pathname, item.href)
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {item.name}
            </Link>
          ))}
          {showOther ? <OtherDropdown pathname={pathname} /> : null}
          {contact ? (
            <Link
              href={contact.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isPublicActive(pathname, contact.href)
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {contact.name}
            </Link>
          ) : null}
        </div>

        <div className="hidden md:block">
          <Link href="/contact" className="button-base button-primary px-5 py-3">
            Start a Project
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-100 md:hidden"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((value) => !value)}
        >
          <span aria-hidden="true" className="relative h-4 w-5">
            <span
              className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition-transform ${
                isOpen ? 'translate-y-[7px] rotate-45' : ''
              }`}
            />
            <span
              className={`absolute left-0 top-[7px] h-0.5 w-5 bg-current transition-opacity ${
                isOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`absolute left-0 top-[14px] h-0.5 w-5 bg-current transition-transform ${
                isOpen ? '-translate-y-[7px] -rotate-45' : ''
              }`}
            />
          </span>
        </button>
      </nav>

      {isOpen ? (
        <div className="border-t border-white/8 bg-[#080c13]/96 px-4 pb-6 pt-2 shadow-xl backdrop-blur-xl md:hidden">
          <div className="container-page flex flex-col gap-2">
            {publicNavItems().map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-3 text-base font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white"
              >
                {item.name}
              </Link>
            ))}
            {showOther ? (
              <div className="rounded-md px-3 py-2">
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Other</p>
                {otherItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-md px-0 py-2 text-base font-semibold text-slate-300 hover:text-white"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            ) : null}
            {contact ? (
              <Link
                href={contact.href}
                className="rounded-md px-3 py-3 text-base font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white"
              >
                {contact.name}
              </Link>
            ) : null}
            <Link href="/contact" className="button-base button-primary mt-3">
              Start a Project
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
