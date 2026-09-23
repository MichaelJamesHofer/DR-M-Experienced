import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SHORTS, shortDurationLabel, shortTypeLabel } from "@/data/shorts";
import { SITE_SHORT_NAME } from "@/lib/site-brand";

export const metadata: Metadata = {
  title: "Shorts",
  description: `Browse short ${SITE_SHORT_NAME} videos, practical clips, and recipes.`,
  alternates: { canonical: "/shorts/" },
};

export default function ShortsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      <header className="mb-10 max-w-2xl">
        <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-primary">
          Short-form library
        </p>
        <h1 className="mb-4 text-display font-bold text-foreground">Shorts</h1>
        <p className="text-body-lg text-foreground-muted">
          Practical excerpts and recipes from Dr. David Musnick.
        </p>
        <Link href="/recipes/" className="mt-5 inline-flex min-h-11 items-center text-body font-medium text-primary underline underline-offset-4">Recipes & kitchen methods →</Link>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SHORTS.map((item) => {
          const portrait = item.posterHeight > item.posterWidth;
          return (
            <Link
              key={item.id}
              href={item.websitePath}
              className="group overflow-hidden rounded-lg border border-border bg-surface transition-[border-color,box-shadow] duration-300 hover:border-primary hover:shadow-glow-sm focus-visible:border-primary focus-visible:shadow-glow-sm"
            >
              <div className={`relative w-full overflow-hidden bg-surface-elevated ${portrait ? "aspect-[9/16]" : "aspect-video"}`}>
                <Image
                  src={item.posterUrl}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="p-5">
                <div className="mb-2 flex items-center gap-2 text-caption text-foreground-muted">
                  <span>{shortTypeLabel(item.contentType)}</span>
                  <span aria-hidden="true">/</span>
                  <span>{shortDurationLabel(item.durationSeconds)}</span>
                </div>
                <h2 className="text-heading font-semibold text-foreground transition-colors group-hover:text-primary">
                  {item.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-body-sm text-foreground-muted">{item.summary}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
