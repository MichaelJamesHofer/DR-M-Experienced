"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";

type EpisodeTopicRailProps = {
  topics: string[];
};

type ScrollAvailability = {
  backward: boolean;
  forward: boolean;
};

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function EpisodeTopicRail({ topics }: EpisodeTopicRailProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const railId = useId();
  const [scrollAvailability, setScrollAvailability] = useState<ScrollAvailability>({
    backward: false,
    forward: false,
  });

  const updateScrollAvailability = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const nextAvailability = {
      backward: viewport.scrollLeft > 2,
      forward: viewport.scrollLeft < maxScrollLeft - 2,
    };

    setScrollAvailability((current) =>
      current.backward === nextAvailability.backward &&
      current.forward === nextAvailability.forward
        ? current
        : nextAvailability,
    );
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const animationFrame = window.requestAnimationFrame(updateScrollAvailability);
    const resizeObserver = new ResizeObserver(updateScrollAvailability);
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild) resizeObserver.observe(viewport.firstElementChild);
    viewport.addEventListener("scroll", updateScrollAvailability, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", updateScrollAvailability);
    };
  }, [topics, updateScrollAvailability]);

  function scrollToPosition(left: number) {
    viewportRef.current?.scrollTo({
      left,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function scrollByPage(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const distance = Math.max(176, viewport.clientWidth * 0.72);
    viewport.scrollBy({
      left: direction * distance,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function handleRailKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollByPage(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollByPage(1);
    } else if (event.key === "Home") {
      event.preventDefault();
      scrollToPosition(0);
    } else if (event.key === "End") {
      event.preventDefault();
      const viewport = viewportRef.current;
      if (viewport) scrollToPosition(viewport.scrollWidth);
    }
  }

  return (
    <section className="mt-6 min-w-0" aria-labelledby={`${railId}-label`}>
      <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
        <p
          id={`${railId}-label`}
          className="text-caption font-semibold uppercase text-foreground-subtle"
        >
          Topics
        </p>
        <div
          className="flex shrink-0 items-center gap-1"
          role="group"
          aria-label="Scroll episode topics"
        >
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            disabled={!scrollAvailability.backward}
            aria-label="Previous episode topics"
            aria-controls={railId}
            title="Previous topics"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-foreground-muted transition-all duration-200 enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-default disabled:opacity-30 motion-reduce:transition-none"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            disabled={!scrollAvailability.forward}
            aria-label="Next episode topics"
            aria-controls={railId}
            title="Next topics"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-foreground-muted transition-all duration-200 enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-default disabled:opacity-30 motion-reduce:transition-none"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative -mx-4 sm:mx-0">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-200 motion-reduce:transition-none ${
            scrollAvailability.backward ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-200 motion-reduce:transition-none ${
            scrollAvailability.forward ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          id={railId}
          ref={viewportRef}
          role="region"
          tabIndex={0}
          aria-label="Scrollable episode topics"
          onKeyDown={handleRailKeyDown}
          className="overflow-x-auto overscroll-x-contain px-4 pb-2 pt-1 outline-none [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:scroll-auto sm:px-0 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-1.5"
        >
          <div className="flex w-max snap-x snap-mandatory gap-2 pr-4 sm:pr-0">
            {topics.map((topic) => (
              <Link
                key={topic}
                href={`/episodes?topic=${encodeURIComponent(topic.toLowerCase())}`}
                className="inline-flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap rounded-md border border-border bg-surface px-4 py-2 text-body-sm capitalize text-foreground-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transform-none motion-reduce:transition-none"
              >
                {topic.replaceAll("-", " ")}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
