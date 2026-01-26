export const metadata = {
  title: "Disclaimer",
  description: "Legal disclaimer and boundaries for Dr. M's Experienced Functional and Sports Medicine educational content.",
};

const sections = [
  {
    icon: "⚕️",
    title: "Medical disclaimer",
    items: [
      "Dr. M's Experienced Functional and Sports Medicine publishes educational content only.",
      "Listening, reading, or submitting a form does not create a doctor–patient relationship.",
      "Always consult your own licensed clinician before acting on concepts from our episodes or resources.",
    ],
  },
  {
    icon: "💰",
    title: "Affiliate & sponsor disclosure",
    items: [
      "From time to time we may mention tools or services that use affiliate links or sponsor support.",
      "We only reference products we actually use with ourselves or clients and we disclose compensation every time.",
    ],
  },
  {
    icon: "🔒",
    title: "HIPAA & privacy",
    items: [
      "We do not request personal health information through this site.",
      "Do not send lab results, imaging, or urgent medical questions via the contact form.",
      "Case stories are de-identified and often composited to maintain privacy.",
    ],
  },
  {
    icon: "💊",
    title: "Supplement & health claims",
    items: [
      "We use structure/function language and do not claim to diagnose, treat, cure, or prevent disease.",
      "If we link to supplements, we include dosing and safety context plus an invite to discuss with your clinician.",
    ],
  },
];

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6 lg:py-16">
      {/* Header */}
      <div className="mb-12">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
          Legal
        </p>
        <h1 className="text-display font-bold text-foreground mb-4">
          Disclaimer & boundaries
        </h1>
        <p className="text-body-lg text-foreground-muted">
          Dr. M&apos;s Experienced Functional and Sports Medicine is about clarity and trust. Please read the notes below to understand 
          how we operate online.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-border bg-surface p-8"
          >
            <h2 className="text-heading font-semibold text-foreground mb-6 flex items-center gap-3">
              <span className="text-2xl">{section.icon}</span>
              {section.title}
            </h2>
            <ul className="space-y-4">
              {section.items.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
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

      {/* Last updated */}
      <p className="mt-12 text-body-sm text-foreground-subtle text-center">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>
    </div>
  );
}
