import { ContactForm } from "@/components/contact-form";

export const metadata = {
  title: "Contact",
  description: "Get in touch with the Dr. M's Experienced Functional and Sports Medicine team for podcast feedback, business inquiries, or speaking engagements.",
};

const contactReasons = [
  {
    icon: "🎙️",
    title: "Podcast feedback",
    description: "Episode ideas, guest suggestions, or general feedback. We read every message.",
  },
  {
    icon: "💼",
    title: "Business & speaking",
    description: "Consulting, course licensing, or speaking engagements. Include dates and scope.",
  },
  {
    icon: "📝",
    title: "Press & media",
    description: "Interview requests, media features, or collaboration opportunities.",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      {/* Header */}
      <div className="mb-12">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
          Get in touch
        </p>
        <h1 className="text-display font-bold text-foreground mb-4">
          Contact us
        </h1>
        <p className="text-body-lg text-foreground-muted max-w-2xl">
          We can&apos;t provide personal medical advice through this form, but we
          love hearing from listeners, partners, and event organizers.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Contact Reasons */}
        <div className="space-y-4">
          {contactReasons.map((reason) => (
            <div
              key={reason.title}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <span className="text-2xl mb-3 block">{reason.icon}</span>
              <h3 className="text-body font-semibold text-foreground mb-2">
                {reason.title}
              </h3>
              <p className="text-body-sm text-foreground-muted">
                {reason.description}
              </p>
            </div>
          ))}
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-surface p-8">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
