/**
 * Thin wrapper around the Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * Uses fetch directly rather than pulling in the Resend SDK, since sending a
 * single transactional email doesn't need it.
 */
export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailSendError";
  }
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;

  if (!apiKey || !from) {
    throw new EmailSendError(
      "Email is not configured: RESEND_API_KEY and EMAIL_FROM_ADDRESS must be set."
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EmailSendError(`Resend API request failed (${res.status}): ${body}`);
  }

  return (await res.json()) as { id: string };
}
