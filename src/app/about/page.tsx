import Link from "next/link";
import Image from "next/image";
import { MEDIA_FEATURES } from "@/data/media";
import { physicianProfileExperience, physicianProfileYears } from "@/data/physician-profile";

export const metadata = {
  title: "About Dr. David Musnick",
  description: `Meet Dr. David Musnick, MD - board-certified in Internal Medicine and Sports Medicine, with deep Functional Medicine experience across ${physicianProfileExperience.patientCare} in patient care.`,
};

const credentials = [
  { label: "Internal Medicine", org: "ABIM Board Certified" },
  { label: "Sports Medicine", org: "CAQ Certified" },
  { label: "Functional Medicine", org: "Certified Functional Medicine Practitioner" },
];

const specialtyHighlights = [
  "Functional Medicine, Internal Medicine, Sports Medicine, and Functional Immunology",
  "Homeopathy (CEDH method) and Frequency Specific Microcurrent",
  "Prolotherapy, scar treatments, and ultrasound-guided regenerative injections",
  "Genomics interpretation and personalized nutrition/supplement mapping",
  "Medical-legal orthopedic consultations and independent medical exams",
  "Complex conditions: concussion/TBI, brain-based symptoms, fatigue, cognitive impairment, IBS, SIBO, autoimmune illness, arthritis, mold/biotoxin illness, EDS, hormone imbalances, chronic pain",
];

const treatmentList = [
  "Bone Marrow Aspirate injections for osteoarthritis",
  "EFT Tapping training for stress and anxiety",
  "Frequency Specific Microcurrent (FSM)",
  "Genetic assessment and interpretation",
  "Homeopathy from the French School of Homeopathy",
  "Low Level Laser Therapy (LLLT)",
  "Neural Therapy",
  "Peri-neural injections for pain",
  "Prolotherapy regenerative injections of the spine and extremities",
  "Non-surgical regenerative treatments for ligaments, tendons, and joints",
  "Pulsed Electromagnetic Field (PEMF)",
  "Scar assessment and treatment",
  "Platelet Rich Plasma (PRP)",
  "Ultrasound-guided injections",
];

const sportsFocus = [
  {
    title: "Whole-person orthopedic evaluations",
    description:
      "Every orthopedic or sports concern begins with an in-depth history and physical exam. Dr. Musnick maps every joint, ligament, tendon, muscle, nerve, and pain-processing pathway involved, then layers supplements, homeopathy, FSM, physical therapy, manual care, and regenerative injections as needed.",
  },
  {
    title: "Osteoarthritis (OA)",
    description:
      "Whole-person plans for knees, hips, neck, thumbs, low back, and ankles: exercise and posture updates, shoe-wear shifts, nutrition and homeopathy, microcurrent, Prolotherapy, non-surgical regenerative options, and Bone Marrow Aspirate. He authored the OA chapter in Metabolic Orthopedics.",
  },
  {
    title: "Ligament sprains & joint instability",
    description:
      "Supports incomplete healing after sprains with targeted PT plus Prolotherapy or other regenerative injections to rebuild collagen, fibroblasts, and stability in knees, thumbs, shoulders, hips, ankles, and feet.",
  },
  {
    title: "Tendonitis & tendinopathy",
    description:
      "Combines ultrasound diagnostics with biomechanical screens. Treatment spans exercise modification, microcurrent, laser therapy, and non-surgical regenerative injections to restore tendon capacity.",
  },
  {
    title: "Neck & cervical spine",
    description: `Evaluates cervical pain for joint hypermobility and destabilizing scars. Offers numerous options—including ${physicianProfileExperience.neckProlotherapy} of neck Prolotherapy experience—to rebuild integrity.`,
  },
  {
    title: "Muscle pain, spasm, and trigger points",
    description:
      "Identifies the root drivers of chronic spasm and uses FSM, Counterstrain, and trigger point injections to calm tissue.",
  },
  {
    title: "Ehlers-Danlos & hypermobility syndromes",
    description:
      "Delivers comprehensive ergonomics, shoe-wear, microcurrent, homeopathy, and regenerative injections (Prolotherapy and other non-surgical regenerative options) to stabilize lax tissues.",
  },
  {
    title: "Disc & nerve-root injuries",
    description:
      "Helps patients understand whether surgery is necessary or if excellent non-surgical choices—FSM, PT, regenerative injections—can resolve disc and nerve issues.",
  },
];

const functionalExpertise = [
  {
    title: "Brain & autonomic system",
    items: [
      { label: "Concussion", detail: "Dr. Musnick created a comprehensive concussion protocol based on brain pathophysiology: assessments, therapeutic nutrition, supplements, exercise, EMF reduction, brain training, and FSM. He contributed a chapter to Integrative Neurology." },
      { label: "Memory disorders", detail: "Full assessment and treatment programs for cognitive impairment, early dementia, and brain fog." },
      { label: "Other neurologic cases", detail: "ADD, Parkinson's disease, MS, peripheral and cranial neuropathy, limbic system dysfunction." },
      { label: "POTS and dysautonomia", detail: "Whole-person strategies for postural orthostatic tachycardia and EDS-related challenges." },
    ],
  },
  {
    title: "Hormones, sleep, and mood",
    items: [
      { label: "Hormone imbalance", detail: "Adrenal, thyroid, and testosterone imbalance—including Hashimoto's support." },
      { label: "Insomnia", detail: "Decades of teaching on non-medication and medication approaches using homeopathy, supplements, tapping, stress management, sleep hygiene, and prescriptions only when needed." },
      { label: "Mood disorders", detail: "Depression and anxiety treatment blending supplements, homeopathy, exercise, tapping, and other modalities when medications fall short or cause side effects." },
      { label: "Stress & PTSD", detail: "Limbic system reset and anxiety management with tapping, microcurrent, breath work, and nervous-system retraining." },
    ],
  },
  {
    title: "GI, metabolic, and immune",
    items: [
      { label: "GI disorders", detail: "Complex SIBO and IBS cases with motility issues." },
      { label: "Fatty liver", detail: "Alcoholic and non-alcoholic: precise diagnostics, diet upgrades, phosphatidylcholine, leaky-gut repair, and FSM to decrease inflammation, swelling, and fibrosis." },
      { label: "Post-COVID & Long COVID", detail: "Addresses loss of taste and smell plus multi-organ sequelae with supplements, homeopathy, and microcurrent." },
      { label: "Cardiovascular & lipids", detail: "Functional medicine options for patients avoiding statins." },
      { label: "Energy & fatigue", detail: "Evaluates hormones, mitochondrial ATP/energy production, and lifestyle factors." },
      { label: "Oxalates", detail: "Low-oxalate nutrition coaching." },
      { label: "MCAS", detail: "Mast Cell Activation support backed by years of diagnostic and treatment experience." },
      { label: "Allergies & sensitivities", detail: "Food, inhalant, mold, sulfur, oxalates, glyphosate assessment." },
    ],
  },
];

const publications = [
  { title: "Integrative Approaches to Concussion and Traumatic Brain Injury", source: "Integrative Neurology, Oxford University Press (2020)" },
  { title: "Osteoarthritis & Tendinosis chapters", source: "Metabolic Therapies in Orthopedics, CRC Press (2019)" },
  { title: "Concussion and TBI", source: "Townsend Letter (May 2019)" },
  { title: "Osteoarthritis", source: "Advancing Medicine with Food and Nutrients, 2nd Ed. (2013)" },
  { title: "Exercise Prescription", source: "Textbook of Functional Medicine (2010)" },
  { title: "Scientific Evidence for Musculoskeletal, Bariatric, and Sports Nutrition", source: "CRC Press (2006) — Osteoarthritis chapter" },
  { title: "Conditioning for Outdoor Fitness", source: "Mountaineers Publishing, 2nd Ed. (2004)" },
  { title: "Medical Screening & Cervical Instability", source: "Therapeutic Exercise: Moving Toward Function (2005) and Orthopedic Physical Therapy Clinics (2001)" },
  { title: "Rowing Injuries", source: "Medical Issues of Active and Athletic Women (1994)" },
];

const lectures = [
  { venue: "Forum for Integrative Medicine", topic: "Concussion/TBI pathophysiology and healing", year: "2020" },
  { venue: "FSM Advanced Meetings", topic: "Insomnia, chronic orthopedic pain, and brain injury workshops", year: "2019–2021" },
  { venue: "IFM Annual Meeting", topic: "Chronic orthopedic pain workshop; functional medicine approach to TBI", year: "2017, 2019" },
  { venue: "WA & BC Naturopathic Physicians", topic: "Concussion/TBI lectures", year: "2018–2020" },
  { venue: "Andrews University", topic: "Three-day chronic pain seminar", year: "2019" },
  { venue: "Bastyr University", topic: "Chronic orthopedic pain intensive", year: "2019" },
  { venue: "BetterHealthGuy Podcast", topic: "Concussion and TBI", year: "2020" },
];

const facultyTraining = [
  { role: "Teaching Faculty", org: "Institute for Functional Medicine" },
  { role: "Sports & Orthopedic Medicine Faculty", org: "Bastyr University", duration: physicianProfileExperience.bastyrFaculty },
  { role: "Professor, Department of Physical Therapy", org: "Andrews University" },
  { role: "Faculty", org: "UW Department of Sports Medicine & Orthopedics and Department of Rehabilitation" },
];

const recentCME = [
  "CEDH clinical homeopathy",
  "Cogence Immunology training",
  "IFM pain management and autoimmune intensives",
  "FSM Advanced Meetings",
  "SIBO training with Alison Siebecker",
  "EMF protection",
  "Genomics interpretation",
  "Ongoing internal medicine board review",
];

const featuredMedia = MEDIA_FEATURES.slice(0, 4);

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6 lg:py-14">
      <section className="mb-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="lg:pt-6">
            <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-primary">
              Meet the physician
            </p>
            <h1 className="mb-6 max-w-3xl text-display font-bold text-foreground">
              Dr. David Musnick, MD
            </h1>
            <p className="max-w-3xl text-body-lg text-foreground-muted">
              Board-certified in Internal Medicine (ABIM) and Sports Medicine (CAQ), with deep
              Functional Medicine training and {physicianProfileExperience.patientCare} in patient care across concussion,
              brain-based symptoms and conditions, autoimmune conditions, fatigue, arthritis,
              gastrointestinal symptoms and conditions, orthopedics, and sports medicine.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#clinical-domains"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-body-sm font-bold text-background transition-colors duration-200 hover:bg-primary-hover"
              >
                Explore clinical focus
              </Link>
              <Link
                href="#featured-media"
                className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-body-sm font-bold text-foreground transition-colors duration-200 hover:border-primary hover:text-primary"
              >
                View media
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-heading-sm font-bold text-foreground">{physicianProfileExperience.patientCare}</p>
                <p className="mt-1 text-caption text-foreground-muted">Patient care</p>
              </div>
              {credentials.map((cred) => (
                <div
                  key={cred.label}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <p className="text-heading-sm font-bold text-foreground">{cred.label}</p>
                  <p className="mt-1 text-caption text-foreground-muted">{cred.org}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="order-first lg:order-none">
            <div className="rounded-2xl border border-border bg-surface p-4 lg:p-6">
              <div className="flex gap-4 lg:block">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-surface-elevated to-surface lg:mb-6 lg:aspect-square lg:h-auto lg:w-full">
                  <Image
                    src="/images/davidmusnicksketch.jpg"
                    alt="Dr. David Musnick"
                    width={520}
                    height={520}
                    className="h-full w-full object-cover"
                    priority
                  />
                </div>
                <dl className="grid flex-1 gap-3 text-body-sm">
                  <div className="grid gap-1">
                    <dt className="text-foreground-muted">Location</dt>
                    <dd className="font-medium text-foreground">Idaho (relocated {physicianProfileYears.idahoRelocation})</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-foreground-muted">Experience</dt>
                    <dd className="font-medium text-foreground">{physicianProfileExperience.patientCare}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-foreground-muted">Focus</dt>
                    <dd className="font-medium text-foreground">
                      Functional Medicine & Sports Medicine
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mb-16 border-t border-border pt-10 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
        <div>
          <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-primary">
            Clinical biography
          </p>
          <h2 className="text-heading-xl font-bold text-foreground">
            The background behind the episodes
          </h2>
        </div>
        <div className="mt-6 space-y-5 text-body text-foreground-muted lg:mt-0">
          <p>
            David Musnick, MD, has dedicated {physicianProfileExperience.patientCare} to patient care, with deep clinical work
            in concussion, brain-based symptoms and conditions, autoimmune conditions, fatigue,
            arthritis, and gastrointestinal symptoms and conditions, alongside his broader work
            in Sports Medicine, Internal Medicine, Regenerative Medicine, and {physicianProfileExperience.functionalMedicine} of
            Functional Medicine. His career includes thousands of complex orthopedic and
            neurologic cases, long-standing work at his Bellevue practice, and formal
            collaborations with multidisciplinary teams in Seattle, Bellevue, and Idaho.
          </p>
          <p>
            He developed detailed decision trees for joint, tendon, muscle, nerve, concussion,
            and brain-related conditions, published in books such as <em>Metabolic Orthopedics</em> and{" "}
            <em>Integrative Neurology</em>. He routinely lectures nationally on osteoarthritis,
            cognitive decline, concussion, long COVID, and dysautonomia, and is frequently retained
            for medical-legal orthopedic consultations and independent medical exams.
          </p>
          <p>
            A Certified Functional Medicine practitioner for {physicianProfileExperience.certifiedFunctionalMedicine}—and one of IFM&apos;s
            earliest teachers—Dr. Musnick spent {physicianProfileExperience.seattlePractice} in Seattle before relocating to Idaho in {physicianProfileYears.idahoRelocation}.
          </p>
        </div>
      </section>

      <section id="clinical-domains" className="mb-16 scroll-mt-28">
        <div className="mb-6 max-w-3xl">
          <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-primary">
            Clinical focus
          </p>
          <h2 className="mb-4 text-heading-xl font-bold text-foreground">
            Specialty domains at a glance
          </h2>
          <p className="text-body text-foreground-muted">
            A quick index of the clinical areas covered by Dr. Musnick&apos;s background, writing,
            teaching, and educational episodes.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {specialtyHighlights.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <p className="text-body text-foreground-muted leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-primary">
            Treatment tools
          </p>
          <h2 className="mb-4 text-heading-xl font-bold text-foreground">
            Treatments Dr. Musnick administers
          </h2>
          <p className="text-body text-foreground-muted">
            Each plan blends hands-on diagnostics with precise therapeutic tools. Here are the modalities he personally delivers:
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {treatmentList.map((treatment, index) => (
              <p key={index} className="text-body-sm text-foreground-muted py-1">
                {treatment}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-16">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-primary">
            Orthopedic & sports medicine
          </p>
          <h2 className="mb-4 text-heading-xl font-bold text-foreground">
            Decision-order care for every tissue
          </h2>
          <p className="text-body text-foreground-muted">
            Every evaluation captures the involved tissues, neurologic tone, and pain-processing patterns before layering interventions.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {sportsFocus.map((focus, index) => (
            <div key={index} className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="text-heading font-semibold text-foreground mb-3">{focus.title}</h3>
              <p className="text-body-sm text-foreground-muted leading-relaxed">{focus.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-primary">
            Functional medicine focus
          </p>
          <h2 className="mb-4 text-heading-xl font-bold text-foreground">
            Systems Dr. Musnick evaluates in depth
          </h2>
          <p className="text-body text-foreground-muted">
            His functional immunology and neurology background lets him map how each system interacts with orthopedic complaints.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {functionalExpertise.map((area, index) => (
            <div key={index} className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="text-heading font-semibold text-foreground mb-5">{area.title}</h3>
              <div className="space-y-4">
                {area.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="border-l-2 border-primary/30 pl-4">
                    <p className="text-body-sm font-semibold text-foreground mb-1">{item.label}</p>
                    <p className="text-body-sm text-foreground-muted leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-primary">
            Evidence trail
          </p>
          <h2 className="mb-4 text-heading-xl font-bold text-foreground">
            Publications, lectures, teaching, and training
          </h2>
          <p className="text-body text-foreground-muted">
            The page keeps the full proof record visible, but groups it as a clinical evidence trail
            instead of scattering it across unrelated sections.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-8">
            <h2 className="text-heading-lg font-bold text-foreground mb-6">Selected publications</h2>
            <div className="divide-y divide-border">
              {publications.map((pub, index) => (
                <div key={index} className="py-4 first:pt-0 last:pb-0">
                  <p className="text-body font-semibold text-foreground mb-1">{pub.title}</p>
                  <p className="text-body-sm text-foreground-muted">{pub.source}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-8">
            <h2 className="text-heading-lg font-bold text-foreground mb-6">Lectures & workshops</h2>
            <div className="divide-y divide-border">
              {lectures.map((lecture, index) => (
                <div key={index} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <p className="text-body font-semibold text-foreground">{lecture.venue}</p>
                    <span className="text-caption text-foreground-subtle shrink-0">{lecture.year}</span>
                  </div>
                  <p className="text-body-sm text-foreground-muted">{lecture.topic}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-8">
            <h3 className="text-heading font-semibold text-foreground mb-5">Faculty positions</h3>
            <div className="divide-y divide-border">
              {facultyTraining.map((item, index) => (
                <div key={index} className="py-4 first:pt-0 last:pb-0">
                  <p className="text-body font-semibold text-foreground mb-1">{item.role}</p>
                  <p className="text-body-sm text-foreground-muted">
                    {item.org}
                    {item.duration && <span className="text-foreground-subtle"> · {item.duration}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-8">
            <h3 className="text-heading font-semibold text-foreground mb-5">Recent continuing education</h3>
            <div className="flex flex-wrap gap-2">
              {recentCME.map((item, index) => (
                <span
                  key={index}
                  className="rounded-full bg-surface-elevated px-4 py-2 text-body-sm text-foreground-muted"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="featured-media" className="mb-16 scroll-mt-28">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-heading-xl font-bold text-foreground">Featured media</h2>
          <Link
            href="/media"
            className="hidden sm:inline-flex items-center gap-2 text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors duration-200"
          >
            View all
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {featuredMedia.map((media) => (
            <a
              key={media.url}
              href={media.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-border bg-surface p-6 hover:border-primary/50 transition-all duration-200"
            >
              <p className="text-caption font-semibold text-primary mb-2">{media.show}</p>
              <h3 className="text-body font-semibold text-foreground group-hover:text-primary transition-colors duration-200 mb-2">
                {media.title}
              </h3>
              <p className="text-body-sm text-foreground-muted line-clamp-2">{media.summary}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-heading-xl font-bold text-foreground mb-6">Outside the clinic</h2>
        <div className="rounded-2xl border border-border bg-surface p-8">
          <p className="text-body text-foreground-muted leading-relaxed">
            Mountain biking in Sedona, hiking Rainier, skiing, cooking, nature photography, and time
            with friends and his daughter all keep him grounded. That blend of outdoor life plus
            constant learning informs the way he approaches every episode and clinical decision tree.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-border bg-surface p-8">
        <h2 className="text-heading font-semibold text-foreground mb-4">Educational Only</h2>
        <div className="space-y-3 text-body text-foreground-muted leading-relaxed">
          <p>
            Dr. M&apos;s Experienced Functional and Sports Medicine is an educational platform. This page summarizes
            Dr. Musnick&apos;s background to provide context for the podcast and does not create
            a doctor–patient relationship.
          </p>
          <p>
            Always work directly with your chosen clinician for diagnosis and treatment.
            Case examples are de-identified and may be composited to protect privacy.
          </p>
        </div>
      </section>
    </div>
  );
}
