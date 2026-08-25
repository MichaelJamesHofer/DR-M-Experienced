import type { ReactNode } from "react";
import { HeroParallaxArt } from "@/components/hero-parallax-art";

type HomeHeroProps = {
  children: ReactNode;
};

export function HomeHero({ children }: HomeHeroProps) {
  return (
    <section
      className="relative flex min-h-[clamp(560px,calc(100svh-7.5rem),640px)] border-b border-[#0a0f1a]/10 bg-[#f6f2e1] text-[#0a0f1a] max-[350px]:min-h-[440px]"
      data-home-hero
    >
      <HeroParallaxArt />
      {children}
    </section>
  );
}
