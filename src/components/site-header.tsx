'use client';

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlatformBadges } from "@/components/platform-badges";
import { SITE_HOST_LINE, SITE_SHORT_NAME } from "@/lib/site-brand";

const navLinks = [
  { href: "/episodes", label: "Episodes" },
  { href: "/blogs", label: "Blogs" },
  { href: "/affiliates", label: "Affiliates" },
  { href: "/media", label: "Media" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menu = mobileMenuRef.current;
    if (!menu) return;

    if (mobileMenuOpen) {
      menu.removeAttribute("inert");
    } else {
      menu.setAttribute("inert", "");
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktopNavigation = window.matchMedia("(min-width: 1280px)");
    const closeAtDesktopWidth = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };

    desktopNavigation.addEventListener("change", closeAtDesktopWidth);
    return () => desktopNavigation.removeEventListener("change", closeAtDesktopWidth);
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-border bg-[var(--header-bg)] backdrop-blur-lg"
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 lg:px-6">
        <Link href="/" className="group flex min-h-11 min-w-0 items-center gap-3" aria-label="Dr. M Experienced home">
          <Image
            src="/icon.svg"
            alt=""
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 shrink-0 rounded-lg transition-transform duration-200 group-hover:scale-[1.03]"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground sm:text-caption sm:font-semibold sm:uppercase">
              {SITE_SHORT_NAME}<span className="hidden sm:inline">,</span>
            </p>
            <p className="hidden text-body-sm font-semibold leading-tight text-foreground-muted sm:block">
              {SITE_HOST_LINE}
            </p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 xl:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined}
              className="inline-flex min-h-11 items-center px-1 text-body-sm font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-4 xl:flex">
          <PlatformBadges variant="compact" />
          <div className="h-5 w-px bg-border" />
          <ThemeToggle />
        </div>

        {/* Mobile Menu Button */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground-muted transition-colors duration-200 hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 xl:hidden"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
        >
          <span className="relative h-5 w-5" aria-hidden="true">
            <Menu
              className={`absolute inset-0 h-5 w-5 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
                mobileMenuOpen ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <X
              className={`absolute inset-0 h-5 w-5 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
                mobileMenuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
              }`}
            />
          </span>
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        ref={mobileMenuRef}
        id="mobile-navigation"
        aria-hidden={!mobileMenuOpen}
        className={`absolute inset-x-0 top-full max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain border-b border-border bg-surface px-4 py-3 shadow-xl transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none sm:inset-x-auto sm:right-4 sm:mt-2 sm:w-96 sm:rounded-lg sm:border xl:hidden ${
          mobileMenuOpen
            ? "visible translate-y-0 opacity-100"
            : "invisible pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <nav className="divide-y divide-border border-b border-border pb-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined}
              className="flex min-h-12 items-center rounded-sm text-body font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between py-3">
          <PlatformBadges variant="compact" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
