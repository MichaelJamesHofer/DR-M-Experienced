import Link from "next/link";
import { ContactForm } from "@/components/contact-form";

export const metadata = {
  title: "Contact",
  description: "Contact DrMExperienced for podcast feedback, media, speaking, and teaching inquiries; use Peak Medicine for consultation requests.",
};

const contactReasons = [
  {
    title: "Podcast feedback",
    description: "Episode ideas, guest suggestions, references, or general feedback for DrMExperienced.",
  },
  {
    title: "Speaking or interview",
    description: "Lectures, webinars, clinician teaching, podcast interviews, and media requests. Include audience, topic, format, and timeline.",
  },
  {
    title: "Consultation request",
    description: "Patient-facing consultations and medical-legal inquiries should start through Peak Medicine, the separate practice site.",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      {/* Header */}
      <div className="mb-12">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
          Contact
        </p>
        <h1 className="text-display font-bold text-foreground mb-4">
          Route podcast and consultation questions correctly
        </h1>
        <p className="text-body-lg text-foreground-muted max-w-2xl">
          Use this page for podcast feedback, guest ideas, media requests, and speaking or teaching inquiries. Patient-specific consultation requests should start through Peak Medicine.
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
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-body text-foreground-muted">
        Looking for a consultation?{" "}
        <Link href="https://peakmedicine.com/contact" className="font-semibold text-primary hover:underline">
          Contact Peak Medicine
        </Link>
        .
      </div>
    </div>
  );
}
