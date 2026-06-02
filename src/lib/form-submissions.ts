type FormSubmission =
  | {
      type: "newsletter";
      email: string;
      source: string;
      website?: string;
      page_url: string | null;
      user_agent: string | null;
    }
  | {
      type: "contact";
      name: string;
      email: string;
      subject: string;
      message: string;
      consent: boolean;
      website?: string;
      page_url: string | null;
      user_agent: string | null;
    };

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://tdbsuzciwotleualdcjf.supabase.co";

export async function submitFormSubmission(payload: FormSubmission) {
  const response = await fetch(`${supabaseUrl}/functions/v1/form-submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "omit",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = "Form submission failed";
    try {
      const body = await response.json();
      if (typeof body.error === "string") {
        errorMessage = body.error;
      }
    } catch {
      // Ignore non-JSON error responses.
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
