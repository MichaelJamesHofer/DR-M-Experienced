import Link from "next/link";
import Image from "next/image";
import { MEDIA_FEATURES } from "@/data/media";

export const metadata = {
  title: "About Dr. David Musnick",
  description: "Meet Dr. David Musnick, MD – board-certified internist, sports medicine physician, and integrative medicine specialist with 35+ years of experience.",
};

const credentials = [
  { label: "Internal Medicine", org: "ABIM Board Certified" },
  { label: "Sports Medicine", org: "CAQ Certified" },
  { label: "Integrative Medicine", org: "ABOIM Board Certified" },
];

const specialtyHighlights = [
  "Functional Medicine, Internal Medicine, Sports Medicine, and Functional Immunology",
  "Homeopathy (CEDH method) and Frequency Specific Microcurrent",
  "Prolotherapy, scar treatments, and ultrasound-guided regenerative injections",
  "Genomics interpretation and personalized nutrition/supplement mapping",
  "Medical-legal orthopedic consultations and independent medical exams",
  "Complex conditions: concussion/TBI, fatigue, cognitive impairment, IBS, SIBO, autoimmune illness, mold/biotoxin illness, EDS, hormone imbalances, chronic pain",
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
      "Unique integrative plans for knees, hips, neck, thumbs, low back, and ankles: exercise and posture updates, shoe-wear shifts, nutrition and homeopathy, microcurrent, Prolotherapy, non-surgical regenerative options, and Bone Marrow Aspirate. He authored the OA chapter in Metabolic Orthopedics.",
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
    description:
      "Evaluates cervical pain for joint hypermobility and destabilizing scars. Offers numerous options—including more than 26 years of neck Prolotherapy experience—to rebuild integrity.",
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
      { label: "Concussion", detail: "Dr. Musnick created the world's first integrative concussion protocol based on brain pathophysiology—comprehensive assessments, therapeutic nutrition, supplements, exercise, EMF reduction, brain training, and FSM. He contributed a chapter to Integrative Neurology." },
      { label: "Memory disorders", detail: "Full assessment and treatment programs for cognitive impairment, early dementia, and brain fog." },
      { label: "Other neurologic cases", detail: "ADD, Parkinson's disease, MS, peripheral and cranial neuropathy, limbic system dysfunction." },
      { label: "POTS and dysautonomia", detail: "Integrative strategies for postural orthostatic tachycardia and EDS-related challenges." },
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
      { label: "Cardiovascular & lipids", detail: "Integrative options for patients avoiding statins." },
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
  { role: "Sports & Orthopedic Medicine Faculty", org: "Bastyr University", duration: "16 years" },
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
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      {/* Hero Section */}
      <section className="mb-16">
        <div className="grid gap-10 lg:grid-cols-5 lg:gap-16 items-start">
          <div className="lg:col-span-3">
            <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-3">
              Meet the physician
            </p>
            <h1 className="text-display font-bold text-foreground mb-6">
              Dr. David Musnick, MD
            </h1>
            <p className="text-body-lg text-foreground-muted mb-6">
              Board-certified internist (ABIM), sports medicine physician (CAQ), and integrative 
              medicine specialist (ABOIM) with 35+ years of orthopedic, neurologic, and functional 
              medicine innovation across the Pacific Northwest.
            </p>
            <div className="space-y-4 text-body text-foreground-muted mb-8">
              <p>
                David Musnick, MD, has dedicated 35+ years to Sports Medicine and Internal Medicine 
                and 28 years to Functional Medicine. His career includes thousands of complex orthopedic 
                and neurologic cases, long-standing work at his Bellevue practice, and formal 
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
                A Certified Functional Medicine practitioner for more than 25 years—and one of IFM&apos;s 
                earliest teachers—Dr. Musnick spent 33 years in Seattle before relocating to Idaho in 2022.
              </p>
            </div>
            {/* Credentials */}
            <div className="flex flex-wrap gap-3">
              {credentials.map((cred) => (
                <div
                  key={cred.label}
                  className="rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <p className="text-body-sm font-semibold text-foreground">{cred.label}</p>
                  <p className="text-caption text-foreground-muted">{cred.org}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-surface-elevated to-surface mb-6">
                <Image
                  src="/images/davidmusnicksketch.jpg"
                  alt="Dr. David Musnick"
                  width={400}
                  height={400}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              <dl className="space-y-3 text-body-sm">
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">Location</dt>
                  <dd className="text-foreground font-medium">Idaho (relocated 2022)</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">Experience</dt>
                  <dd className="text-foreground font-medium">35+ years</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">Focus</dt>
                  <dd className="text-foreground font-medium text-right">Integrative sports &<br />functional medicine</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Specialty Highlights */}
      <section className="mb-16">
        <h2 className="text-heading-xl font-bold text-foreground mb-6">Specialty domains at a glance</h2>
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

      {/* Treatments */}
      <section className="mb-16">
        <h2 className="text-heading-xl font-bold text-foreground mb-4">Treatments Dr. Musnick administers</h2>
        <p className="text-body text-foreground-muted mb-8">
          Each plan blends hands-on diagnostics with precise therapeutic tools. Here are the modalities he personally delivers:
        </p>
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

      {/* Orthopedic & Sports Medicine */}
      <section className="mb-16">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-3">
          Orthopedic & sports medicine
        </p>
        <h2 className="text-heading-xl font-bold text-foreground mb-4">Decision-order care for every tissue</h2>
        <p className="text-body text-foreground-muted mb-8">
          Every evaluation captures the involved tissues, neurologic tone, and pain-processing patterns before layering interventions.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {sportsFocus.map((focus, index) => (
            <div key={index} className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="text-heading font-semibold text-foreground mb-3">{focus.title}</h3>
              <p className="text-body-sm text-foreground-muted leading-relaxed">{focus.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Functional Medicine Focus */}
      <section className="mb-16">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-3">
          Functional medicine focus
        </p>
        <h2 className="text-heading-xl font-bold text-foreground mb-4">Systems Dr. Musnick evaluates in depth</h2>
        <p className="text-body text-foreground-muted mb-8">
          His functional immunology and neurology background lets him map how each system interacts with orthopedic complaints.
        </p>
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

      {/* Publications & Lectures */}
      <section className="mb-16">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Publications */}
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

          {/* Lectures */}
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
      </section>

      {/* Teaching & Training */}
      <section className="mb-16">
        <h2 className="text-heading-xl font-bold text-foreground mb-6">Teaching & ongoing training</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Faculty Roles */}
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

          {/* Recent CME */}
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

      {/* Featured Media */}
      <section className="mb-16">
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

      {/* Outside the Clinic */}
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

      {/* Disclaimer */}
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
