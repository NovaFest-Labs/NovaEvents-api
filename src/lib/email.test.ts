import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, EmailSendError } from "./email";

describe("sendEmail", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM_ADDRESS = "NovaEvents <notifications@test.com>";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("throws EmailSendError when RESEND_API_KEY is not configured", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(
      sendEmail({ to: "a@b.com", subject: "hi", html: "<p>hi</p>" })
    ).rejects.toBeInstanceOf(EmailSendError);
  });

  it("throws EmailSendError when the Resend API responds with an error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "invalid recipient",
    }) as unknown as typeof fetch;

    await expect(
      sendEmail({ to: "a@b.com", subject: "hi", html: "<p>hi</p>" })
    ).rejects.toBeInstanceOf(EmailSendError);
  });

  it("returns the sent email id on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "email_abc" }),
    }) as unknown as typeof fetch;

    const result = await sendEmail({ to: "a@b.com", subject: "hi", html: "<p>hi</p>" });

    expect(result.id).toBe("email_abc");
  });
});
