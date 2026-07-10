'use client';

import { FormEvent, useId, useState } from "react";
import Link from "next/link";
import { submitFormSubmission } from "@/lib/form-submissions";

type Status = "idle" | "loading" | "success" | "error";

type NewsletterCaptureProps = {
  variant?: "hero" | "inline" | "footer";
  heading?: string;
  description?: string;
  className?: string;
};

export function NewsletterCapture({
  variant = "inline",
  heading = "Get the latest",
  description = "Weekly insights on functional medicine, sports performance, and actionable health strategies. No spam. Unsubscribe through the contact page.",
  className = "",
}: NewsletterCaptureProps) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const emailId = useId();
  const isLoading = status === "loading";
  const isSubmitted = status === "success";
  const isDisabled = isLoading || isSubmitted;
  const feedbackMessage =
    status === "success"
      ? "Submitted. You are on the list."
      : status === "error"
        ? "Could not subscribe. Please try again."
        : "";
  const feedbackClassName =
    status === "error"
      ? "border-error/30 bg-error/10 text-error"
      : "border-success/30 bg-success/10 text-success";

  // Email validation function
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  function getSubmissionMetadata() {
    if (typeof window === "undefined") {
      return { page_url: null, user_agent: null };
    }

    return {
      page_url: window.location.href.slice(0, 1000),
      user_agent: window.navigator.userAgent.slice(0, 500),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDisabled) return;

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
      if (website) {
        setStatus("success");
        setEmail("");
        setWebsite("");
        return;
      }

      await submitFormSubmission({
        type: "newsletter",
        email: trimmedEmail.toLowerCase(),
        source: variant || "unknown",
        ...getSubmissionMetadata(),
      });

      setStatus("success");
      setEmail("");
      setWebsite("");
    } catch (error) {
      setStatus("error");
      console.error('Newsletter subscription error:', error);
    }
  }

  if (variant === "hero") {
    return (
      <div className={`w-full max-w-xl ${className}`}>
        <div className="text-center mb-6">
          <h2 className="text-heading-lg font-semibold text-foreground mb-2">
            {heading}
          </h2>
          <p className="text-body text-foreground-muted">
            {description}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />
          <label htmlFor={emailId} className="sr-only">Email address</label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={isDisabled}
            className="flex-1 rounded-xl border border-border bg-surface px-5 py-4 text-body text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-all duration-200"
          />
          <button
            type="submit"
            disabled={isDisabled}
            className="rounded-xl bg-primary px-8 py-4 text-body font-semibold text-background hover:bg-primary-hover disabled:opacity-60 transition-all duration-200 shadow-glow-sm hover:shadow-glow"
          >
            {isLoading ? "Subscribing..." : isSubmitted ? "Submitted" : "Subscribe"}
          </button>
        </form>
        {feedbackMessage && (
          <p
            role="status"
            aria-live="polite"
            className={`mt-3 rounded-xl border px-4 py-3 text-center text-sm ${feedbackClassName}`}
          >
            {feedbackMessage}
          </p>
        )}
        <PrivacyLink />
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <div className={className}>
        <p className="text-body font-semibold text-foreground mb-2">
          {heading}
        </p>
        <p className="text-body-sm text-foreground-muted mb-4">
          {description}
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />
          <label htmlFor={emailId} className="sr-only">Email address</label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={isDisabled}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-body-sm text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none disabled:opacity-60 transition-all duration-200"
          />
          <button
            type="submit"
            disabled={isDisabled}
            className="min-w-[4rem] rounded-lg bg-primary px-5 py-2.5 text-body-sm font-semibold text-background hover:bg-primary-hover disabled:opacity-60 transition-all duration-200"
          >
            {isLoading ? "..." : isSubmitted ? "Done" : "Go"}
          </button>
        </form>
        {feedbackMessage && (
          <p
            role="status"
            aria-live="polite"
            className={`mt-2 rounded-lg border px-3 py-2 text-caption ${feedbackClassName}`}
          >
            {feedbackMessage}
          </p>
        )}
        <PrivacyLink compact />
      </div>
    );
  }

  // Default inline variant
  return (
    <div className={`rounded-2xl border border-border bg-surface p-6 ${className}`}>
      <h2 className="text-heading font-semibold text-foreground mb-2">
        {heading}
      </h2>
      <p className="text-body-sm text-foreground-muted mb-4">
        {description}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />
        <label htmlFor={emailId} className="sr-only">Email address</label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          disabled={isDisabled}
          className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-body-sm text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-all duration-200"
        />
        <button
          type="submit"
          disabled={isDisabled}
          className="w-full rounded-lg bg-primary px-6 py-3 text-body-sm font-semibold text-background hover:bg-primary-hover disabled:opacity-60 transition-all duration-200"
        >
          {isLoading ? "Subscribing..." : isSubmitted ? "Submitted" : "Subscribe"}
        </button>
      </form>
      {feedbackMessage && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 rounded-lg border px-3 py-2 text-caption ${feedbackClassName}`}
        >
          {feedbackMessage}
        </p>
      )}
      <PrivacyLink />
    </div>
  );
}

function PrivacyLink({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`${compact ? "mt-2" : "mt-3"} text-caption text-foreground-subtle`}>
      See the{" "}
      <Link href="/legal/privacy" className="font-semibold text-foreground-muted underline underline-offset-2">
        privacy notice
      </Link>
      .
    </p>
  );
}
