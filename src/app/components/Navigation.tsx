"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { company, navItems } from "../data/site";

function Logo() {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-sm font-black text-white shadow-sm"
      >
        BO
      </span>
      <span className="font-extrabold tracking-tight text-slate-100">
        {company.name}
      </span>
    </span>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-200 ${
        isScrolled
          ? "border-b border-white/8 bg-[#080c13]/88 shadow-lg shadow-black/10 backdrop-blur-xl"
          : "bg-[#080c13]/45 backdrop-blur-sm"
      }`}
    >
      <nav className="container-page flex h-20 items-center justify-between">
        <Link href="/" aria-label={`${company.name} home`}>
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive =
              item.href === "/#process"
                ? false
                : pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-slate-950 text-white"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:block">
          <Link
            href="/contact"
            className="button-base button-primary px-5 py-3"
          >
            Start a Project
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-100 md:hidden"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((value) => !value)}
        >
          <span aria-hidden="true" className="relative h-4 w-5">
            <span
              className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition-transform ${
                isOpen ? "translate-y-[7px] rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[7px] h-0.5 w-5 bg-current transition-opacity ${
                isOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[14px] h-0.5 w-5 bg-current transition-transform ${
                isOpen ? "-translate-y-[7px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </nav>

      {isOpen ? (
        <div className="border-t border-white/8 bg-[#080c13]/96 px-4 pb-6 pt-2 shadow-xl backdrop-blur-xl md:hidden">
          <div className="container-page flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-3 text-base font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white"
              >
                {item.name}
              </Link>
            ))}
            <Link href="/contact" className="button-base button-primary mt-3">
              Start a Project
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
