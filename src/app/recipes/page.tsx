import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SHORTS, shortDurationLabel, shortTypeLabel } from "@/data/shorts";

export const metadata: Metadata = {
  title: "Recipes & kitchen methods",
  description: "Save the ingredients and practical kitchen methods demonstrated by Dr. David Musnick, alongside their original short videos.",
  alternates: { canonical: "/recipes/" },
};

export default function RecipesPage() {
  const recipes = SHORTS.filter((item) => item.contentType === "recipe" || item.contentType === "kitchen_method");
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      <header className="mb-10 max-w-2xl">
        <Link href="/shorts/" className="mb-4 inline-flex min-h-11 items-center text-body-sm text-primary">← All shorts</Link>
        <h1 className="mb-4 text-display font-bold text-foreground">Recipes & kitchen methods</h1>
        <p className="text-body-lg text-foreground-muted">Keep the ingredients and steps beside you in the kitchen. Each guide follows the recorded demonstration and explains when quantities were not measured.</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((item) => (
          <Link key={item.id} href={item.websitePath} className="group overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-primary focus-visible:border-primary">
            <div className="relative aspect-[4/3] overflow-hidden bg-surface-elevated"><Image src={item.posterUrl} alt="" fill className="object-contain" /></div>
            <div className="p-5">
              <p className="mb-2 text-caption text-foreground-muted">{shortTypeLabel(item.contentType)} · {shortDurationLabel(item.durationSeconds)}</p>
              <h2 className="text-heading font-semibold text-foreground group-hover:text-primary">{item.title}</h2>
              <p className="mt-2 text-body-sm text-foreground-muted">{item.summary}</p>
              <span className="mt-4 inline-flex min-h-11 items-center text-body-sm font-semibold text-primary">See the method →</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
