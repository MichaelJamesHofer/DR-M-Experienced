'use client';

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = 'idle' | 'loading' | 'success' | 'error';

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // Input validation and sanitization
  function sanitizeInput(input: string, maxLength: number): string {
    return input.trim().slice(0, maxLength);
  }

  function isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    const message = sanitizeInput((formData.get('message') as string) || '', 5000);

    // Client-side validation
    if (!name || !email || !subject || !message) {
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
      // Try Supabase first (preferred)
      if (supabase) {
        const { error } = await supabase
          .from('contact_messages')
          .insert({
            name: name,
            email: email.toLowerCase(),
            subject: subject,
            message: message,
            // Don't set created_at - let database handle it
          });

        if (error) throw error;

        setStatus('success');
        setMessage('Thanks! We received your note.');
        form.reset();
        return;
      }

      // Fallback: Try Formspree
      const formspreeId = process.env.NEXT_PUBLIC_FORMSPREE_FORM_ID;
      
      if (formspreeId) {
        const response = await fetch(`https://formspree.io/f/${formspreeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            email: email,
            subject: subject,
            message: message,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Unable to send message');
        }

        setStatus('success');
        setMessage('Thanks! We received your note.');
        form.reset();
        return;
      }

      // Last resort: try API route (won't work in static export)
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          subject: subject,
          message: message,
        }),
      });

      if (!response.ok) throw new Error('Unable to send message');

      setStatus('success');
      setMessage('Thanks! We received your note.');
      form.reset();
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error && error.message.includes('Supabase')
          ? 'Please configure Supabase credentials in environment variables.'
          : 'We could not send your message. Please try again later.'
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="text-body-sm font-medium text-foreground mb-2 block">
            Name
          </label>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
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
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
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
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
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
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 resize-none"
          placeholder="What can we help with?"
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="consent"
          className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-primary/30"
        />
        <span className="text-body-sm text-foreground-muted">
          I understand this form is not for medical advice, diagnosis, or emergencies.
        </span>
      </label>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-xl bg-primary px-8 py-3 text-body font-semibold text-background hover:bg-primary-hover disabled:opacity-60 transition-all duration-200 shadow-glow-sm hover:shadow-glow"
        >
          {status === 'loading' ? 'Sending...' : 'Send message'}
        </button>
        {message && (
          <p className={`text-body-sm ${status === 'error' ? 'text-error' : 'text-success'}`}>
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
