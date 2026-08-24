import Image from "next/image";
import Link from "next/link";
import { Rss } from "lucide-react";
import { PlatformBadges } from "@/components/platform-badges";
import { NewsletterCapture } from "@/components/newsletter-capture";
import { PODCAST_FEED_URL, SITE_DESCRIPTION, SITE_HOST_LINE, SITE_NAME, SITE_SHORT_NAME } from "@/lib/site-brand";

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
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.1fr_0.9fr_1fr]">
          <div className="min-w-0 text-center md:text-left">
            <div className="mb-4 flex items-center justify-center gap-3 md:justify-start">
              <Image
                src="/icon.svg"
                alt=""
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded-lg"
              />
              <div>
                <p className="text-caption font-semibold uppercase text-foreground-muted">
                  {SITE_SHORT_NAME},
                </p>
                <p className="text-body-sm font-semibold text-foreground">
                  {SITE_HOST_LINE}
                </p>
              </div>
            </div>
            <p className="mx-auto mb-6 max-w-xs text-body-sm text-foreground-muted md:mx-0">
              {SITE_DESCRIPTION}
            </p>
            <PlatformBadges variant="compact" className="mb-4 justify-center md:justify-start" />
            <a
              href={PODCAST_FEED_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-body-sm text-foreground-muted transition-colors duration-200 hover:text-foreground"
            >
              <Rss className="h-4 w-4" aria-hidden="true" />
              RSS Feed
            </a>
          </div>

          <div className="min-w-0">
            <p className="text-body-sm font-semibold text-foreground mb-4">Navigation</p>
            <nav className="grid grid-cols-2 gap-x-4">
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center text-body-sm text-foreground-muted transition-colors duration-200 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="min-w-0">
            <NewsletterCapture
              variant="footer"
              heading="Join the newsletter"
              description="Practical health updates that reduce the noise."
            />
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
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
