"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from "react";

const assetBase = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";

function assetPath(path: string) {
  return `${assetBase}${path}`;
}

const transparentPixel =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

export function HeroParallaxArt() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const section = scene?.closest<HTMLElement>("[data-home-hero]");
    if (!scene || !section) return;
    const sceneElement: HTMLDivElement = scene;
    const sectionElement: HTMLElement = section;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");
    let sectionTop = 0;
    let sectionHeight = 1;
    let currentProgress = 0;
    let targetProgress = 0;
    let frame = 0;
    let isVisible = false;

    const motionAllowed = () => !reducedMotion.matches && !coarsePointer.matches;

    function renderFrame() {
      frame = 0;
      currentProgress += (targetProgress - currentProgress) * 0.14;

      if (Math.abs(targetProgress - currentProgress) < 0.001) {
        currentProgress = targetProgress;
      }

      sceneElement.style.setProperty("--hero-progress", currentProgress.toFixed(4));

      if (currentProgress !== targetProgress) {
        frame = window.requestAnimationFrame(renderFrame);
      }
    }

    function queueFrame() {
      if (!frame) frame = window.requestAnimationFrame(renderFrame);
    }

    function updateTarget() {
      if (!motionAllowed() || !isVisible) return;
      targetProgress = Math.min(
        1,
        Math.max(0, (window.scrollY - sectionTop) / sectionHeight)
      );
      queueFrame();
    }

    function measureScene() {
      sectionTop = sectionElement.getBoundingClientRect().top + window.scrollY;
      sectionHeight = Math.max(1, sectionElement.offsetHeight);
      updateTarget();
    }

    function updateMotionPolicy() {
      sceneElement.dataset.motionActive = String(isVisible && motionAllowed());
      if (motionAllowed()) {
        measureScene();
        return;
      }

      targetProgress = 0;
      currentProgress = 0;
      sceneElement.style.setProperty("--hero-progress", "0");
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    }

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      sceneElement.dataset.motionActive = String(isVisible && motionAllowed());
      if (isVisible) {
        updateTarget();
      } else if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    });

    observer.observe(sectionElement);
    window.addEventListener("scroll", updateTarget, { passive: true });
    window.addEventListener("resize", measureScene, { passive: true });
    reducedMotion.addEventListener("change", updateMotionPolicy);
    coarsePointer.addEventListener("change", updateMotionPolicy);
    measureScene();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateTarget);
      window.removeEventListener("resize", measureScene);
      reducedMotion.removeEventListener("change", updateMotionPolicy);
      coarsePointer.removeEventListener("change", updateMotionPolicy);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={sceneRef}
      className="home-hero-scene pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <picture className="home-hero-layer home-hero-layer--far absolute -inset-6 block">
        <source
          media="(max-width: 639px)"
          srcSet={`${assetPath("/images/brand/hero-cartography-v3/mobile-960.webp")} 960w, ${assetPath("/images/brand/hero-cartography-v3/mobile-1440.webp")} 1440w`}
          sizes="calc(100vw + 48px)"
          type="image/webp"
        />
        <source
          media="(max-width: 899px)"
          srcSet={`${assetPath("/images/brand/hero-cartography-v3/tablet-1440.webp")} 1440w, ${assetPath("/images/brand/hero-cartography-v3/tablet-2160.webp")} 2160w`}
          sizes="calc(100vw + 48px)"
          type="image/webp"
        />
        <source
          media="(min-width: 900px)"
          srcSet={`${assetPath("/images/brand/hero-cartography-v3/desktop-base-1920.webp")} 1920w, ${assetPath("/images/brand/hero-cartography-v3/desktop-base-2880.webp")} 2880w, ${assetPath("/images/brand/hero-cartography-v3/desktop-base-4096.webp")} 4096w`}
          sizes="calc(100vw + 48px)"
          type="image/webp"
        />
        <img
          src={assetPath("/images/brand/hero-cartography-v3/desktop-base-1920.webp")}
          alt=""
          width="1920"
          height="853"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      </picture>

      <picture className="home-hero-layer home-hero-layer--near absolute -inset-6 hidden min-[900px]:block">
        <source
          media="(min-width: 900px)"
          srcSet={`${assetPath("/images/brand/hero-cartography-v3/desktop-foreground-1920.webp")} 1920w, ${assetPath("/images/brand/hero-cartography-v3/desktop-foreground-2880.webp")} 2880w, ${assetPath("/images/brand/hero-cartography-v3/desktop-foreground-4096.webp")} 4096w`}
          sizes="calc(100vw + 48px)"
          type="image/webp"
        />
        <img
          src={transparentPixel}
          alt=""
          width="1920"
          height="853"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      </picture>

      <svg
        className="home-hero-layer home-hero-layer--route absolute -inset-6 hidden h-[calc(100%+3rem)] w-[calc(100%+3rem)] min-[900px]:block"
        viewBox="0 0 1881 836"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <path
          d="M 1110 812 C 1252 776 1328 704 1414 632 C 1510 552 1596 432 1754 264"
          fill="none"
          stroke="#e6a20a"
          strokeWidth="3"
          strokeDasharray="10 13"
          strokeLinecap="round"
          opacity="0.82"
        />
        <circle cx="1754" cy="264" r="10" fill="#f6f2e1" stroke="#e6a20a" strokeWidth="3" />
        <circle cx="1754" cy="264" r="3" fill="#e6a20a" />
      </svg>

      <div className="home-hero-scrim absolute inset-0" />
    </div>
  );
}
