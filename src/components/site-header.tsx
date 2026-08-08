'use client';

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[var(--header-bg)] backdrop-blur-lg">
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
              className="inline-flex min-h-11 items-center px-1 text-body-sm font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground"
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
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground-muted transition-colors duration-200 hover:bg-surface hover:text-foreground xl:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div id="mobile-navigation" className="animate-fade-in border-t border-border bg-surface px-4 py-3 xl:hidden">
          <nav className="divide-y divide-border border-b border-border pb-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-12 items-center text-body font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground"
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
      )}
    </header>
  );
}
