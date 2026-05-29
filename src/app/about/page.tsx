import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "About David Musnick, MD",
  description:
    "Learn how DrMExperienced connects David Musnick, MD's clinical teaching with Peak Medicine consultations.",
};

const profilePoints = [
  {
    title: "Clinical background",
    description:
      "David Musnick, MD is a licensed medical practitioner with long experience in internal medicine, functional medicine, concussion/TBI, chronic pain, functional immunology, and complex multi-system case review.",
  },
  {
    title: "Teaching lens",
    description:
      "DrMExperienced translates clinical reasoning into podcast episodes, short essays, interviews, and professional education rather than acting as a substitute for medical care.",
  },
  {
    title: "Practice connection",
    description:
      "Peak Medicine is the practice site for consultations, speaking, teaching, and medical-legal inquiries. DrMExperienced is the education and podcast site.",
  },
];

const topicAreas = [
  "Concussion, TBI, brain fog, memory, and cognitive decline",
  "Autoimmune illness, functional immunology, and modifiable triggers",
  "Hypermobility, hEDS, POTS, and autonomic dysfunction",
  "GI tolerance, diet strategy, long COVID, infections, and environmental contributors",
  "Complex case sequencing for patients, clinicians, attorneys, and informed listeners",
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      <section className="mb-16 grid gap-10 lg:grid-cols-5 lg:gap-16 lg:items-start">
        <div className="lg:col-span-3">
          <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-3">
            About
          </p>
          <h1 className="text-display font-bold text-foreground mb-6">
            David Musnick, MD
          </h1>
          <p className="text-body-lg text-foreground-muted mb-6">
            DrMExperienced is the teaching and podcast platform for Dr. Musnick&apos;s clinical thinking. It introduces the frameworks; Peak Medicine handles formal consultation and professional inquiries.
          </p>
          <div className="flex flex-wrap gap-3">
            {["Internal Medicine", "Sports Medicine", "Integrative Medicine"].map((credential) => (
              <span key={credential} className="rounded-xl border border-border bg-surface px-4 py-3 text-body-sm font-semibold text-foreground">
                {credential}
              </span>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-surface-elevated to-surface">
              <Image
                src="/images/davidmusnicksketch.jpg"
                alt="Dr. David Musnick"
                width={400}
                height={400}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mb-16 grid gap-6 md:grid-cols-3">
        {profilePoints.map((point) => (
          <article key={point.title} className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-heading font-semibold text-foreground mb-3">{point.title}</h2>
            <p className="text-body-sm leading-6 text-foreground-muted">{point.description}</p>
          </article>
        ))}
      </section>

      <section className="mb-16 rounded-3xl border border-border bg-surface p-8">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-3">
          Teaching focus
        </p>
        <h2 className="text-heading-xl font-bold text-foreground mb-4">
          Topics carried by the podcast
        </h2>
        <p className="text-body text-foreground-muted mb-8 max-w-2xl">
          The site keeps the topic list concise so listeners can understand the main lanes without mistaking this for a clinic service menu.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {topicAreas.map((item) => (
            <div key={item} className="rounded-2xl border border-border bg-background p-4 text-body-sm text-foreground-muted">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-border bg-surface p-8 md:grid-cols-2">
        <div>
          <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-3">
            Consultations
          </p>
          <h2 className="text-heading-xl font-bold text-foreground mb-4">
            Patient-specific questions start at Peak Medicine.
          </h2>
          <p className="text-body text-foreground-muted mb-6">
            If you are looking for a consultation, expert witness inquiry, speaking engagement, teaching request, or podcast interview, start through Peak Medicine so the request can be routed through the correct process.
          </p>
          <Link
            href="https://peakmedicine.com/contact"
            className="inline-flex rounded-full bg-primary px-5 py-3 text-body-sm font-semibold text-background transition hover:bg-primary-hover"
          >
            Contact Peak Medicine
          </Link>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-background p-6 text-body-sm leading-6 text-foreground-muted">
          <p className="font-semibold text-foreground mb-2">Educational only</p>
          <p>
            DrMExperienced does not provide diagnosis, treatment, emergency guidance, or personal medical advice, and it does not create a doctor-patient relationship.
          </p>
        </div>
      </section>
    </div>
  );
}
