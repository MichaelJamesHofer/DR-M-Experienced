'use client';

import { FormEvent, useState } from "react";
import { submitFormSubmission } from "@/lib/form-submissions";

type Status = 'idle' | 'loading' | 'success' | 'error';

const SUBJECTS = new Set(["podcast", "business", "press", "other"]);

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const isLoading = status === 'loading';
  const isSubmitted = status === 'success';
  const isDisabled = isLoading || isSubmitted;

  // Input validation and sanitization
  function sanitizeInput(input: string, maxLength: number): string {
    return input.trim().slice(0, maxLength);
  }

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

    const form = event.currentTarget;
    const formData = new FormData(form);

    if (!formData.get('consent')) {
      setStatus('error');
      setMessage('Please confirm you understand the boundaries.');
      return;
    }

    // Validate and sanitize inputs
    const name = sanitizeInput((formData.get('name') as string) || '', 200);
    const email = sanitizeInput((formData.get('email') as string) || '', 255);
    const subject = sanitizeInput((formData.get('subject') as string) || '', 200);
    const body = sanitizeInput((formData.get('message') as string) || '', 5000);
    const website = sanitizeInput((formData.get('website') as string) || '', 200);

    if (website) {
      setStatus('success');
      setMessage('Submitted. Thanks - your message was captured.');
      form.reset();
      return;
    }

    // Client-side validation
    if (!name || !email || !subject || !body || !SUBJECTS.has(subject)) {
      setStatus('error');
      setMessage('All fields are required.');
      return;
    }

    if (!isValidEmail(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      await submitFormSubmission({
        type: 'contact',
        name,
        email: email.toLowerCase(),
        subject,
        message: body,
        consent: true,
        ...getSubmissionMetadata(),
      });

      setStatus('success');
      setMessage('Submitted. Thanks - your message was captured.');
      form.reset();
    } catch (error) {
      setStatus('error');
      setMessage('We could not send your message. Please try again later.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="text-body-sm font-medium text-foreground mb-2 block">
            Name
          </label>
          <input
            name="name"
            type="text"
            required
            disabled={isDisabled}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-all duration-200"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="text-body-sm font-medium text-foreground mb-2 block">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            disabled={isDisabled}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-all duration-200"
            placeholder="you@email.com"
          />
        </div>
      </div>

      <div>
        <label className="text-body-sm font-medium text-foreground mb-2 block">
          Subject
        </label>
        <select
          name="subject"
          defaultValue="podcast"
          disabled={isDisabled}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-all duration-200"
        >
          <option value="podcast">Podcast feedback</option>
          <option value="business">Business / speaking</option>
          <option value="press">Press / media</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="text-body-sm font-medium text-foreground mb-2 block">
          Message
        </label>
        <textarea
          name="message"
          rows={5}
          required
          disabled={isDisabled}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-all duration-200 resize-none"
          placeholder="What can we help with?"
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="consent"
          disabled={isDisabled}
          className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-primary/30 disabled:opacity-60"
        />
        <span className="text-body-sm text-foreground-muted">
          I understand this form is not for medical advice, diagnosis, or emergencies.
        </span>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isDisabled}
          className="rounded-xl bg-primary px-8 py-3 text-body font-semibold text-background hover:bg-primary-hover disabled:opacity-60 transition-all duration-200 shadow-glow-sm hover:shadow-glow"
        >
          {isLoading ? 'Sending...' : isSubmitted ? 'Message submitted' : 'Send message'}
        </button>
        {message && (
          <p
            role="status"
            aria-live="polite"
            className={`rounded-xl border px-4 py-3 text-body-sm ${
              status === 'error'
                ? 'border-error/30 bg-error/10 text-error'
                : 'border-success/30 bg-success/10 text-success'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
