'use client';

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "idle" | "loading" | "success" | "error";

type NewsletterCaptureProps = {
  variant?: "hero" | "inline" | "footer";
  heading?: string;
  description?: string;
  className?: string;
};

export function NewsletterCapture({
  variant = "inline",
  heading = "Get the protocols",
  description = "Weekly insights on functional medicine, sports performance, and actionable health strategies. No spam, unsubscribe anytime.",
  className = "",
}: NewsletterCaptureProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  // Email validation function
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Client-side validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatus("error");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setStatus("error");
      return;
    }

    setStatus("loading");

    try {
      // Try Supabase first (preferred)
      if (supabase) {
        const { error } = await supabase
          .from('newsletter_subscriptions')
          .insert({
            email: trimmedEmail.toLowerCase(),
            source: variant || 'unknown',
            // Don't set created_at - let database handle it
          });

        if (error) {
          // If duplicate email, treat as success (already subscribed)
          if (error.code === '23505') { // Unique constraint violation
            setStatus("success");
            setEmail("");
            return;
          }
          throw error;
        }

        setStatus("success");
        setEmail("");
        return;
      }

      // Fallback: Try third-party services
      const convertKitApiKey = process.env.NEXT_PUBLIC_CONVERTKIT_API_KEY;
      const convertKitFormId = process.env.NEXT_PUBLIC_CONVERTKIT_FORM_ID;
      const beehiivApiKey = process.env.NEXT_PUBLIC_BEEHIIV_API_KEY;
      const beehiivPubId = process.env.NEXT_PUBLIC_BEEHIIV_PUBLICATION_ID;

      let response: Response;

      if (convertKitApiKey && convertKitFormId) {
        response = await fetch(`https://api.convertkit.com/v3/forms/${convertKitFormId}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: convertKitApiKey,
            email: email,
          }),
        });
      } else if (beehiivApiKey && beehiivPubId) {
        response = await fetch(`https://api.beehiiv.com/v2/publications/${beehiivPubId}/subscriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${beehiivApiKey}`,
          },
          body: JSON.stringify({
            email: email,
          }),
        });
      } else {
        // Last resort: try API route (won't work in static export)
        response = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to subscribe');
      }

      setStatus("success");
      setEmail("");
    } catch (error) {
      setStatus("error");
      console.error('Newsletter subscription error:', error);
    }
  }

  if (variant === "hero") {
    return (
      <div className={`w-full max-w-xl ${className}`}>
        <div className="text-center mb-6">
          <h3 className="text-heading-lg font-semibold text-foreground mb-2">
            {heading}
          </h3>
          <p className="text-body text-foreground-muted">
            {description}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={status === "loading" || status === "success"}
            className="flex-1 rounded-xl border border-border bg-surface px-5 py-4 text-body text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-all duration-200"
          />
          <button
            type="submit"
            disabled={status === "loading" || status === "success"}
            className="rounded-xl bg-primary px-8 py-4 text-body font-semibold text-background hover:bg-primary-hover disabled:opacity-60 transition-all duration-200 shadow-glow-sm hover:shadow-glow"
          >
            {status === "loading" ? "Subscribing..." : status === "success" ? "Subscribed ✓" : "Subscribe"}
          </button>
        </form>
        {status === "error" && (
          <p className="mt-3 text-sm text-error text-center">
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <div className={className}>
        <h4 className="text-body font-semibold text-foreground mb-2">
          {heading}
        </h4>
        <p className="text-body-sm text-foreground-muted mb-4">
          {description}
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={status === "loading" || status === "success"}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-body-sm text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none disabled:opacity-60 transition-all duration-200"
          />
          <button
            type="submit"
            disabled={status === "loading" || status === "success"}
            className="rounded-lg bg-primary px-5 py-2.5 text-body-sm font-semibold text-background hover:bg-primary-hover disabled:opacity-60 transition-all duration-200"
          >
            {status === "success" ? "✓" : "→"}
          </button>
        </form>
        {status === "error" && (
          <p className="mt-2 text-caption text-error">Try again</p>
        )}
      </div>
    );
  }

  // Default inline variant
  return (
    <div className={`rounded-2xl border border-border bg-surface p-6 ${className}`}>
      <h4 className="text-heading font-semibold text-foreground mb-2">
        {heading}
      </h4>
      <p className="text-body-sm text-foreground-muted mb-4">
        {description}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          disabled={status === "loading" || status === "success"}
          className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-body-sm text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-all duration-200"
        />
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="w-full rounded-lg bg-primary px-6 py-3 text-body-sm font-semibold text-background hover:bg-primary-hover disabled:opacity-60 transition-all duration-200"
        >
          {status === "loading" ? "Subscribing..." : status === "success" ? "Subscribed ✓" : "Subscribe"}
        </button>
      </form>
      {status === "error" && (
        <p className="mt-2 text-caption text-error">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
