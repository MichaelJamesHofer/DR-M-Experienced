import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ExternalLink } from "lucide-react";
import { AnimatedDisclosure } from "@/components/animated-disclosure";
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
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
      <section className="border-b border-border pb-10 sm:pb-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-14">
          <div>
            <p className="mb-3 text-caption font-semibold uppercase text-primary">
              Meet the physician
            </p>
            <h1 className="mb-5 max-w-3xl text-4xl font-bold leading-[1.08] text-foreground sm:text-5xl">
              Dr. David Musnick, MD
            </h1>
            <p className="max-w-3xl text-body leading-relaxed text-foreground-muted sm:text-body-lg">
              Board-certified in Internal Medicine (ABIM) and Sports Medicine (CAQ), with deep
              Functional Medicine training and {physicianProfileExperience.patientCare} in patient care across concussion,
              brain-based symptoms and conditions, autoimmune conditions, fatigue, arthritis,
              gastrointestinal symptoms and conditions, orthopedics, and sports medicine.
            </p>

            <nav aria-label="About page sections" className="mt-6 flex flex-wrap gap-3">
              <Link
                href="#clinical-domains"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-body-sm font-bold text-background transition-colors duration-200 hover:bg-primary-hover"
              >
                Explore clinical focus
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="#featured-media"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2 text-body-sm font-bold text-foreground transition-colors duration-200 hover:border-primary hover:text-primary"
              >
                View media
              </Link>
            </nav>

            <div className="mt-8 grid gap-x-6 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border-t border-border py-4">
                <p className="text-heading-sm font-bold text-foreground">{physicianProfileExperience.patientCare}</p>
                <p className="mt-1 text-caption text-foreground-muted">Patient care</p>
              </div>
              {credentials.map((cred) => (
                <div
                  key={cred.label}
                  className="border-t border-border py-4"
                >
                  <p className="text-heading-sm font-bold text-foreground">{cred.label}</p>
                  <p className="mt-1 text-caption text-foreground-muted">{cred.org}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="grid grid-cols-[112px_minmax(0,1fr)] gap-5 sm:grid-cols-[160px_minmax(0,1fr)] lg:block">
            <div className="aspect-square overflow-hidden rounded-lg border border-border bg-white lg:mb-5">
              <Image
                src="/images/davidmusnicksketch.jpg"
                alt="Dr. David Musnick"
                width={520}
                height={520}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <dl className="divide-y divide-border border-y border-border text-body-sm">
              <div className="py-3">
                <dt className="text-foreground-muted">Location</dt>
                <dd className="mt-1 font-medium text-foreground">
                  Idaho (relocated {physicianProfileYears.idahoRelocation})
                </dd>
              </div>
              <div className="py-3">
                <dt className="text-foreground-muted">Experience</dt>
                <dd className="mt-1 font-medium text-foreground">{physicianProfileExperience.patientCare}</dd>
              </div>
              <div className="py-3">
                <dt className="text-foreground-muted">Focus</dt>
                <dd className="mt-1 font-medium text-foreground">
                  Functional Medicine &amp; Sports Medicine
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="grid gap-6 border-b border-border py-10 sm:py-14 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <div>
          <p className="mb-3 text-caption font-semibold uppercase text-primary">
            Clinical biography
          </p>
          <h2 className="text-[1.75rem] font-bold leading-tight text-foreground sm:text-3xl">
            The background behind the episodes
          </h2>
        </div>
        <div className="space-y-4 text-body leading-relaxed text-foreground-muted">
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

      <section id="clinical-domains" className="scroll-mt-28 border-b border-border py-10 sm:py-14">
        <div className="mb-7 max-w-3xl">
          <p className="mb-3 text-caption font-semibold uppercase text-primary">
            Clinical focus
          </p>
          <h2 className="mb-3 text-[1.75rem] font-bold leading-tight text-foreground sm:text-3xl">
            Areas of clinical focus
          </h2>
          <p className="text-body leading-relaxed text-foreground-muted">
            A quick index of the clinical areas covered by Dr. Musnick&apos;s background, writing,
            teaching, and educational episodes.
          </p>
        </div>
        <div className="grid border-b border-border sm:grid-cols-2 sm:gap-x-8">
          {specialtyHighlights.map((item, index) => (
            <div key={index} className="flex gap-4 border-t border-border py-4">
              <span className="w-6 shrink-0 text-caption font-semibold text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-body-sm leading-relaxed text-foreground-muted">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border py-10 sm:py-14">
        <div className="mb-7 max-w-3xl">
          <p className="mb-3 text-caption font-semibold uppercase text-primary">
            Treatment tools
          </p>
          <h2 className="mb-3 text-[1.75rem] font-bold leading-tight text-foreground sm:text-3xl">
            Treatments Dr. Musnick administers
          </h2>
          <p className="text-body leading-relaxed text-foreground-muted">
            Each plan blends hands-on diagnostics with precise therapeutic tools. Here are the modalities he personally delivers:
          </p>
        </div>
        <div className="grid border-b border-border sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
          {treatmentList.map((treatment, index) => (
            <p key={index} className="border-t border-border py-3 text-body-sm leading-relaxed text-foreground-muted">
              {treatment}
            </p>
          ))}
        </div>
      </section>

      <section className="border-b border-border py-10 sm:py-14">
        <div className="mb-7 max-w-3xl">
          <p className="mb-3 text-caption font-semibold uppercase text-primary">
            Orthopedic &amp; sports medicine
          </p>
          <h2 className="mb-3 text-[1.75rem] font-bold leading-tight text-foreground sm:text-3xl">
            Care by tissue and condition
          </h2>
          <p className="text-body leading-relaxed text-foreground-muted">
            Every evaluation captures the involved tissues, neurologic tone, and pain-processing patterns before layering interventions.
          </p>
        </div>
        <div className="grid lg:grid-cols-2 lg:gap-x-10">
          {sportsFocus.map((focus) => (
            <AnimatedDisclosure
              key={focus.title}
              label={focus.title}
              className="border-t border-border last:border-b lg:[&:nth-last-child(-n+2)]:border-b"
              triggerClassName="min-h-14 gap-4 py-3 text-body font-semibold text-foreground"
            >
              <p className="pb-5 pr-9 text-body-sm leading-relaxed text-foreground-muted">
                {focus.description}
              </p>
            </AnimatedDisclosure>
          ))}
        </div>
      </section>

      <section className="border-b border-border py-10 sm:py-14">
        <div className="mb-7 max-w-3xl">
          <p className="mb-3 text-caption font-semibold uppercase text-primary">
            Functional medicine focus
          </p>
          <h2 className="mb-3 text-[1.75rem] font-bold leading-tight text-foreground sm:text-3xl">
            Functional medicine by system
          </h2>
          <p className="text-body leading-relaxed text-foreground-muted">
            His functional immunology and neurology background lets him map how each system interacts with orthopedic complaints.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
          {functionalExpertise.map((area) => (
            <div key={area.title}>
              <h3 className="border-t border-border py-4 text-heading font-semibold text-foreground">
                {area.title}
              </h3>
              {area.items.map((item) => (
                <AnimatedDisclosure
                  key={item.label}
                  label={item.label}
                  className="border-t border-border last:border-b"
                  triggerClassName="min-h-12 gap-3 py-3 text-body-sm font-semibold text-foreground"
                  iconClassName="h-4 w-4"
                >
                  <p className="pb-4 pr-7 text-body-sm leading-relaxed text-foreground-muted">
                    {item.detail}
                  </p>
                </AnimatedDisclosure>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border py-10 sm:py-14">
        <div className="mb-7 max-w-3xl">
          <p className="mb-3 text-caption font-semibold uppercase text-primary">
            Evidence trail
          </p>
          <h2 className="mb-3 text-[1.75rem] font-bold leading-tight text-foreground sm:text-3xl">
            Publications, lectures, teaching, and training
          </h2>
          <p className="text-body leading-relaxed text-foreground-muted">
            Selected publications, lectures, faculty roles, and recent continuing education.
          </p>
        </div>
        <div className="grid gap-x-10 lg:grid-cols-2">
          <AnimatedDisclosure
            className="border-t border-border"
            triggerClassName="min-h-14 gap-4 py-3 text-heading-sm font-semibold text-foreground"
            label={
              <span>
                Selected publications
                <span className="ml-2 text-caption font-normal text-foreground-subtle">{publications.length}</span>
              </span>
            }
          >
            <div className="divide-y divide-border border-t border-border pb-3">
              {publications.map((pub) => (
                <div key={pub.title} className="py-4">
                  <p className="mb-1 text-body font-semibold text-foreground">{pub.title}</p>
                  <p className="text-body-sm leading-relaxed text-foreground-muted">{pub.source}</p>
                </div>
              ))}
            </div>
          </AnimatedDisclosure>

          <AnimatedDisclosure
            className="border-t border-border"
            triggerClassName="min-h-14 gap-4 py-3 text-heading-sm font-semibold text-foreground"
            label={
              <span>
                Lectures &amp; workshops
                <span className="ml-2 text-caption font-normal text-foreground-subtle">{lectures.length}</span>
              </span>
            }
          >
            <div className="divide-y divide-border border-t border-border pb-3">
              {lectures.map((lecture) => (
                <div key={`${lecture.venue}-${lecture.year}`} className="py-4">
                  <div className="mb-1 flex items-start justify-between gap-4">
                    <p className="text-body font-semibold text-foreground">{lecture.venue}</p>
                    <span className="shrink-0 text-caption text-foreground-subtle">{lecture.year}</span>
                  </div>
                  <p className="text-body-sm leading-relaxed text-foreground-muted">{lecture.topic}</p>
                </div>
              ))}
            </div>
          </AnimatedDisclosure>

          <AnimatedDisclosure
            className="border-t border-border lg:border-b"
            triggerClassName="min-h-14 gap-4 py-3 text-heading-sm font-semibold text-foreground"
            label={
              <span>
                Faculty positions
                <span className="ml-2 text-caption font-normal text-foreground-subtle">{facultyTraining.length}</span>
              </span>
            }
          >
            <div className="divide-y divide-border border-t border-border pb-3">
              {facultyTraining.map((item) => (
                <div key={`${item.role}-${item.org}`} className="py-4">
                  <p className="mb-1 text-body font-semibold text-foreground">{item.role}</p>
                  <p className="text-body-sm leading-relaxed text-foreground-muted">
                    {item.org}
                    {item.duration && <span className="text-foreground-subtle"> · {item.duration}</span>}
                  </p>
                </div>
              ))}
            </div>
          </AnimatedDisclosure>

          <AnimatedDisclosure
            className="border-y border-border lg:border-t"
            triggerClassName="min-h-14 gap-4 py-3 text-heading-sm font-semibold text-foreground"
            label={
              <span>
                Recent continuing education
                <span className="ml-2 text-caption font-normal text-foreground-subtle">{recentCME.length}</span>
              </span>
            }
          >
            <div className="divide-y divide-border border-t border-border pb-3">
              {recentCME.map((item) => (
                <p key={item} className="py-3 text-body-sm text-foreground-muted">{item}</p>
              ))}
            </div>
          </AnimatedDisclosure>
        </div>
      </section>

      <section id="featured-media" className="scroll-mt-28 border-b border-border py-10 sm:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-[1.75rem] font-bold leading-tight text-foreground sm:text-3xl">Featured media</h2>
          <Link
            href="/media"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-body-sm font-semibold text-primary transition-colors duration-200 hover:text-primary-hover"
          >
            View all
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid border-b border-border sm:grid-cols-2 sm:gap-x-8">
          {featuredMedia.map((media) => (
            <a
              key={media.url}
              href={media.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-11 gap-4 border-t border-border py-5 transition-colors duration-200 hover:text-primary"
            >
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-caption font-semibold text-primary">{media.show}</p>
                <h3 className="mb-2 text-body font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">
                  {media.title}
                </h3>
                <p className="line-clamp-2 text-body-sm leading-relaxed text-foreground-muted">{media.summary}</p>
              </div>
              <ExternalLink aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-foreground-subtle transition-colors group-hover:text-primary" />
            </a>
          ))}
        </div>
      </section>

      <section className="grid gap-5 border-b border-border py-10 sm:py-14 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <h2 className="text-[1.75rem] font-bold leading-tight text-foreground sm:text-3xl">Outside the clinic</h2>
        <p className="text-body leading-relaxed text-foreground-muted">
          Mountain biking in Sedona, hiking Rainier, skiing, cooking, nature photography, and time
          with friends and his daughter all keep him grounded. That blend of outdoor life plus
          constant learning informs the way he approaches every episode and clinical decision tree.
        </p>
      </section>

      <section className="grid gap-4 pt-8 sm:pt-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <h2 className="text-heading font-semibold text-foreground">Educational Only</h2>
        <div className="space-y-3 text-body-sm leading-relaxed text-foreground-muted">
          <p>
            Dr. M Experienced, with Dr. David Musnick is an educational platform. This page summarizes
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
