import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/stellar", () => ({ simulateContractCall: vi.fn() }));
vi.mock("../lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("../lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));

import { simulateContractCall } from "../lib/stellar";
import { sendEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { TicketNotFoundError } from "../services/eventsService";
import { sendTicketPurchaseConfirmation } from "./notificationService";

const mockSimulateContractCall = vi.mocked(simulateContractCall);
const mockSendEmail = vi.mocked(sendEmail);
const mockLoggerError = vi.mocked(logger.error);

describe("sendTicketPurchaseConfirmation", () => {
  beforeEach(() => {
    mockSimulateContractCall.mockReset();
    mockSendEmail.mockReset();
    mockLoggerError.mockReset();
  });

  it("throws TicketNotFoundError instead of sending when the ticket does not exist", async () => {
    mockSimulateContractCall.mockRejectedValue(new Error("ticket not found"));

    await expect(
      sendTicketPurchaseConfirmation(1, 999, "buyer@example.com")
    ).rejects.toBeInstanceOf(TicketNotFoundError);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns delivered: true when the ticket exists and the email sends", async () => {
    mockSimulateContractCall.mockResolvedValue({ owner: "GABC", event_id: 1, tier_index: 0, redeemed: false });
    mockSendEmail.mockResolvedValue({ id: "email_123" });

    const result = await sendTicketPurchaseConfirmation(1, 5, "buyer@example.com");

    expect(result).toEqual({ delivered: true });
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("returns delivered: false (without throwing) when the email provider fails", async () => {
    mockSimulateContractCall.mockResolvedValue({ owner: "GABC", event_id: 1, tier_index: 0, redeemed: false });
    mockSendEmail.mockRejectedValue(new Error("provider outage"));

    const result = await sendTicketPurchaseConfirmation(1, 5, "buyer@example.com");

    expect(result.delivered).toBe(false);
    expect(result.error).toContain("provider outage");
  });

  it("logs the failure via the shared logger instead of console", async () => {
    mockSimulateContractCall.mockResolvedValue({ owner: "GABC", event_id: 1, tier_index: 0, redeemed: false });
    mockSendEmail.mockRejectedValue(new Error("provider outage"));

    await sendTicketPurchaseConfirmation(1, 5, "buyer@example.com");

    expect(mockLoggerError).toHaveBeenCalledOnce();
  });
});
