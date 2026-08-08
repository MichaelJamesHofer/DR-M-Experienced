import Link from "next/link";

export const metadata = {
  title: "Privacy notice",
  description: "How Dr. M Experienced, with Dr. David Musnick handles form submissions, analytics, and embedded media.",
  alternates: {
    canonical: "/legal/privacy/",
  },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6 lg:py-16">
      <header className="mb-12">
        <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-primary">
          Legal
        </p>
        <h1 className="mb-4 text-display font-bold text-foreground">Privacy notice</h1>
        <p className="text-body-sm text-foreground-muted">Last updated August 8, 2026</p>
      </header>

      <div className="space-y-10 text-body text-foreground-muted">
        <section>
          <h2 className="mb-3 text-heading-lg font-semibold text-foreground">Information we collect</h2>
          <p>
            Newsletter submissions include an email address, the form location, the page URL, and
            browser user-agent information. Contact submissions also include the name, subject, and
            message supplied by the sender. The forms are not intended for medical records, private
            health information, diagnosis requests, or emergencies.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-heading-lg font-semibold text-foreground">How information is used</h2>
          <p>
            Form information is used to respond to appropriate inquiries, manage newsletter interest,
            protect the forms from abuse, and maintain the site. It is not sold. Newsletter addresses
            remain on the list until removal is requested. Contact messages are retained only while
            they remain useful for the inquiry or operational record.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-heading-lg font-semibold text-foreground">Service providers</h2>
          <p>
            The website is delivered through GitHub Pages and Cloudflare. Supabase hosts the content
            catalog, form-processing function, and submitted form data. Episode pages may load media
            from Vimeo or Spotify. Those services may receive network and browser information under
            their own privacy terms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-heading-lg font-semibold text-foreground">Analytics</h2>
          <p>
            Optional PostHog analytics records site page views and page leaves when configured. After
            a form is accepted, it also records the newsletter form location or the selected contact
            subject category. Opening an episode player records the public Vimeo video identifier.
            Names, email addresses, messages, other form values, external referrers, query strings,
            campaign identifiers, persistent browser identifiers, person profiles, autocapture, and
            session recording are excluded by this site&apos;s configuration. The analytics project is
            configured to discard client IP addresses rather than store them with events.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-heading-lg font-semibold text-foreground">Security and retention</h2>
          <p>
            Browser clients cannot read or write the private form tables directly. The receive-only
            function validates and rate-limits submissions before storage. Rate-limit records are
            hashed and records older than eight days are removed during normal form traffic. No online
            service can guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-heading-lg font-semibold text-foreground">Requests</h2>
          <p>
            To request removal from the newsletter or ask about submitted information, use the{" "}
            <Link href="/contact" className="font-semibold text-primary underline underline-offset-2">
              contact form
            </Link>
            . Do not include medical records or other sensitive health information.
          </p>
        </section>
      </div>
    </div>
  );
}
