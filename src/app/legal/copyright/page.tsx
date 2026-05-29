export const metadata = {
  title: "Copyright Notice",
  description: "Copyright notice and permissions policy for Dr. M's Experienced Functional and Sports Medicine.",
};

const sections = [
  {
    title: "What is protected",
    items: [
      "Episodes, show notes, articles, page copy, graphics, downloads, audio, video, and other original materials published by Dr. M's Experienced Functional and Sports Medicine are protected by copyright unless otherwise noted.",
      "The Dr. M's Experienced name, presentation, and site materials may not be copied, mirrored, republished, sold, or used to imply endorsement without written permission.",
    ],
  },
  {
    title: "What is allowed",
    items: [
      "You may link to public pages and episodes.",
      "You may share brief excerpts for commentary, education, or review when you include clear attribution and a link back to the original page.",
      "You may use materials when a separate written license or permission expressly allows that use.",
    ],
  },
  {
    title: "Permission requests",
    items: [
      "Please request written permission before reproducing, adapting, distributing, translating, training systems on, or commercially using substantial portions of site content.",
      "For permissions, licensing, media use, or correction requests, contact the team through the site contact page.",
    ],
  },
  {
    title: "Third-party materials",
    items: [
      "Product names, trademarks, platform logos, embedded media, and third-party materials belong to their respective owners.",
      "Affiliate links and product references do not transfer ownership of third-party marks or materials to Dr. M's Experienced Functional and Sports Medicine.",
    ],
  },
];

export default function CopyrightPage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6 lg:py-16">
      <div className="mb-12">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
          Legal
        </p>
        <h1 className="text-display font-bold text-foreground mb-4">
          Copyright notice
        </h1>
        <p className="text-body-lg text-foreground-muted">
          Copyright {currentYear} Dr. M&apos;s Experienced Functional and Sports Medicine. All rights reserved.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-8 mb-8">
        <h2 className="text-heading font-semibold text-foreground mb-3">
          Short notice
        </h2>
        <p className="text-body text-foreground-muted">
          Copyright {currentYear} Dr. M&apos;s Experienced. All rights reserved.
        </p>
      </div>

      <div className="space-y-8">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-border bg-surface p-8"
          >
            <h2 className="text-heading font-semibold text-foreground mb-6">
              {section.title}
            </h2>
            <ul className="space-y-4">
              {section.items.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 shrink-0 text-foreground-subtle mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-body text-foreground-muted">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-12 text-body-sm text-foreground-subtle text-center">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>
    </div>
  );
}
