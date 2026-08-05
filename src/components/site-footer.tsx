import Link from "next/link";
import { PlatformBadges } from "@/components/platform-badges";
import { NewsletterCapture } from "@/components/newsletter-capture";
import { SITE_DESCRIPTION, SITE_HOST_LINE, SITE_NAME, SITE_SHORT_NAME } from "@/lib/site-brand";

const footerLinks = [
  { href: "/episodes", label: "Episodes" },
  { href: "/blogs", label: "Blogs" },
  { href: "/affiliates", label: "Affiliates" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/copyright", label: "Copyright" },
  { href: "/legal/disclaimer", label: "Disclaimer" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg font-bold text-background">
                ⛰
              </span>
              <div>
                <p className="text-caption font-semibold uppercase tracking-[0.2em] text-foreground-muted">
                  {SITE_SHORT_NAME},
                </p>
                <p className="text-body-sm font-semibold text-foreground">
                  {SITE_HOST_LINE}
                </p>
              </div>
            </div>
            <p className="text-body-sm text-foreground-muted mb-6 max-w-xs">
              {SITE_DESCRIPTION}
            </p>
            <PlatformBadges variant="compact" className="mb-6" />
            <a
              href="https://anchor.fm/s/10e1b0328/podcast/rss"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-body-sm text-foreground-muted hover:text-foreground transition-colors duration-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              RSS Feed
            </a>
          </div>

          {/* Links Column */}
          <div>
            <p className="text-body-sm font-semibold text-foreground mb-4">Navigation</p>
            <nav className="flex flex-col gap-3">
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-body-sm text-foreground-muted hover:text-foreground transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Newsletter Column */}
          <div>
            <NewsletterCapture
              variant="footer"
              heading="Join the newsletter"
              description="Practical health updates that reduce the noise."
            />
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-caption text-foreground-subtle">
            © {new Date().getFullYear()} {SITE_NAME}. Educational content only.
          </p>
          <p className="text-caption text-foreground-subtle">
            Not medical advice. See{" "}
            <Link href="/legal/disclaimer" className="text-foreground-muted underline underline-offset-2 hover:text-foreground transition-colors duration-200">
              disclaimer
            </Link>
            {", "}
            <Link href="/legal/privacy" className="text-foreground-muted underline underline-offset-2 hover:text-foreground transition-colors duration-200">
              privacy notice
            </Link>
            {", and "}
            <Link href="/legal/copyright" className="text-foreground-muted underline underline-offset-2 hover:text-foreground transition-colors duration-200">
              copyright notice
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
