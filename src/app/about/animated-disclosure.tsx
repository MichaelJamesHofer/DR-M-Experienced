"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { Plus } from "lucide-react";

type AnimatedDisclosureProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  iconClassName?: string;
};

export function AnimatedDisclosure({
  label,
  children,
  className = "",
  triggerClassName = "",
  iconClassName = "h-5 w-5",
}: AnimatedDisclosureProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const animationTargetRef = useRef<boolean | null>(null);
  const disclosureId = useId();
  const triggerId = `${disclosureId}-trigger`;
  const panelId = `${disclosureId}-panel`;

  useEffect(() => () => animationRef.current?.cancel(), []);

  function handleSummaryClick(event: MouseEvent<HTMLElement>) {
    const details = detailsRef.current;
    const panel = panelRef.current;
    if (!details || !panel) return;

    event.preventDefault();

    const activeAnimation = animationRef.current;
    const currentlyOpening = activeAnimation
      ? animationTargetRef.current === true
      : details.open;
    const shouldOpen = !currentlyOpening;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      activeAnimation?.cancel();
      animationRef.current = null;
      animationTargetRef.current = null;
      details.open = shouldOpen;
      delete details.dataset.animating;
      delete details.dataset.closing;
      return;
    }

    const startHeight = details.open ? panel.getBoundingClientRect().height : 0;
    if (activeAnimation) {
      activeAnimation.onfinish = null;
      activeAnimation.cancel();
    }

    if (shouldOpen) details.open = true;

    const endHeight = shouldOpen ? panel.scrollHeight : 0;
    details.dataset.animating = "true";
    details.dataset.closing = String(!shouldOpen);
    animationTargetRef.current = shouldOpen;

    const animation = panel.animate(
      [
        { height: `${startHeight}px`, opacity: startHeight === 0 ? 0 : 1 },
        { height: `${endHeight}px`, opacity: shouldOpen ? 1 : 0 },
      ],
      {
        duration: 300,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    );
    animationRef.current = animation;

    animation.onfinish = () => {
      if (animationRef.current !== animation) return;
      if (!shouldOpen) details.open = false;
      animationRef.current = null;
      animationTargetRef.current = null;
      delete details.dataset.animating;
      delete details.dataset.closing;
    };
  }

  return (
    <details ref={detailsRef} className={`animated-disclosure group ${className}`}>
      <summary
        id={triggerId}
        aria-controls={panelId}
        className={`flex w-full cursor-pointer list-none items-center justify-between text-left marker:content-none [&::-webkit-details-marker]:hidden ${triggerClassName}`}
        onClick={handleSummaryClick}
      >
        <span className="min-w-0">{label}</span>
        <Plus
          aria-hidden="true"
          className={`animated-disclosure-icon ${iconClassName} shrink-0 text-primary transition-transform duration-300 ease-out group-open:rotate-45 motion-reduce:transition-none`}
        />
      </summary>
      <div
        ref={panelRef}
        id={panelId}
        aria-labelledby={triggerId}
        className="overflow-hidden"
      >
        {children}
      </div>
    </details>
  );
}
