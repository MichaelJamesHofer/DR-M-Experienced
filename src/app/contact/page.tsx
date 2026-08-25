import { ContactForm } from "@/components/contact-form";
import { BriefcaseBusiness, MessageSquareText, Radio } from "lucide-react";

export const metadata = {
  title: "Contact",
  description: "Get in touch with the Dr. M Experienced, with Dr. David Musnick team for podcast feedback, business inquiries, or speaking engagements.",
};

const contactReasons = [
  {
    icon: Radio,
    title: "Podcast feedback",
    description: "Episode ideas, guest suggestions, or general feedback. We read every message.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Business & speaking",
    description: "Consulting, course licensing, or speaking engagements. Include dates and scope.",
  },
  {
    icon: MessageSquareText,
    title: "Press & media",
    description: "Interview requests, media features, or collaboration opportunities.",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6 lg:py-14">
      <div className="mb-9">
        <p className="mb-2 text-caption font-semibold uppercase text-primary">
          Get in touch
        </p>
        <h1 className="mb-3 text-[2.25rem] font-bold leading-tight text-foreground sm:text-display">
          Contact us
        </h1>
        <p className="max-w-2xl text-body text-foreground-muted sm:text-body-lg">
          We can&apos;t provide personal medical advice through this form, but we
          love hearing from listeners, partners, and event organizers.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div className="divide-y divide-border border-y border-border">
          {contactReasons.map((reason) => (
            <div
              key={reason.title}
              className="grid grid-cols-[2rem_1fr] gap-x-4 py-5"
            >
              <reason.icon className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-body font-semibold text-foreground">
                {reason.title}
              </h2>
              <p className="col-start-2 mt-1 text-body-sm text-foreground-muted">
                {reason.description}
              </p>
            </div>
          ))}
        </div>

        <div className="lg:border-l lg:border-border lg:pl-14">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
