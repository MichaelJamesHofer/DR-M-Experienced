'use client';

import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlatformBadges } from "@/components/platform-badges";

const navLinks = [
  { href: "/episodes", label: "Episodes" },
  { href: "/blog", label: "Blog" },
  { href: "/affiliates", label: "Affiliates" },
  { href: "/media", label: "Media" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[var(--header-bg)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg font-bold text-background shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300">
            ⛰
          </span>
          <div className="hidden sm:block">
            <p className="text-caption font-semibold uppercase tracking-[0.2em] text-foreground-muted">
              DrMExperienced
            </p>
            <p className="text-body-sm font-semibold text-foreground leading-tight">
              Podcast & clinical teaching
            </p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-body-sm font-medium text-foreground-muted hover:text-foreground transition-colors duration-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="https://peakmedicine.com/contact"
            className="rounded-full bg-primary px-4 py-2 text-caption font-bold uppercase tracking-[0.16em] text-background transition hover:bg-primary-hover"
          >
            Consults
          </Link>
          <PlatformBadges variant="compact" />
          <div className="h-5 w-px bg-border" />
          <ThemeToggle />
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface hover:text-foreground transition-colors duration-200 lg:hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-surface px-4 py-6 lg:hidden animate-fade-in">
          <nav className="flex flex-col gap-4 mb-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-body font-medium text-foreground-muted hover:text-foreground transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Link
              href="https://peakmedicine.com/contact"
              className="rounded-full bg-primary px-4 py-2 text-caption font-bold uppercase tracking-[0.16em] text-background"
            >
              Peak consults
            </Link>
            <PlatformBadges variant="compact" />
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}
