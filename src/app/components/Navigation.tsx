"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

interface NavItem {
  name: string;
  href: string;
}

export default function Navigation() {
  const pathname = usePathname();

  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = (): void => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems: NavItem[] = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
    { name: "Services", href: "/services" },
    { name: "Projects", href: "/projects" }
  ];

  const handleMobileMenuToggle = (): void => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = (): void => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-black/20 backdrop-blur-md border-b border-white/10 py-3"
          : "bg-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link
            href="/"
            className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent hover:from-blue-300 hover:to-purple-300 transition-all duration-300 transform hover:scale-105"
          >
            The Byte Office
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-full group ${
                  pathname === item.href
                    ? "text-white bg-white/10"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                <span className="relative z-10">{item.name}</span>

                {/* Hover background */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                {/* Active/Hover underline */}
                <span
                  className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-300 ${
                    pathname === item.href ? "w-6" : "w-0 group-hover:w-6"
                  }`}
                ></span>

                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden relative w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-all duration-300 group"
            onClick={handleMobileMenuToggle}
            aria-label="Toggle mobile menu"
          >
            <div className="relative w-6 h-6">
              {/* Animated hamburger/close icon */}
              <span
                className={`absolute left-0 top-1 w-6 h-0.5 bg-white transition-all duration-300 ${
                  isMobileMenuOpen ? "rotate-45 translate-y-2" : ""
                }`}
              ></span>
              <span
                className={`absolute left-0 top-3 w-6 h-0.5 bg-white transition-all duration-300 ${
                  isMobileMenuOpen ? "opacity-0" : ""
                }`}
              ></span>
              <span
                className={`absolute left-0 top-5 w-6 h-0.5 bg-white transition-all duration-300 ${
                  isMobileMenuOpen ? "-rotate-45 -translate-y-2" : ""
                }`}
              ></span>
            </div>

            {/* Button glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur"></div>
          </button>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-500 ${
            isMobileMenuOpen ? "max-h-96 opacity-100 mt-6" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-2">
            {navItems.map((item, index) => (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300 transform hover:translate-x-2 relative group ${
                  pathname === item.href ? "text-white bg-white/10" : ""
                }`}
                onClick={closeMobileMenu}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                <span className="relative z-10 font-medium">{item.name}</span>

                {/* Mobile item gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                {/* Active indicator */}
                <div
                  className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-1 bg-gradient-to-b from-blue-400 to-purple-400 rounded-r transition-all duration-300 ${
                    pathname === item.href ? "h-6" : "h-0 group-hover:h-6"
                  }`}
                ></div>
              </Link>
            ))}

            {/* Mobile menu footer */}
            <div className="pt-4 mt-6 border-t border-white/10">
              <div className="text-center text-sm text-gray-400">
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-semibold">
                  The Byte Office
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu backdrop */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm -z-10"
          onClick={closeMobileMenu}
        ></div>
      )}
    </nav>
  );
}
