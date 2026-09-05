import { sendEmail } from "../lib/email";
import { getTicketById, TicketNotFoundError } from "./eventsService";

export { TicketNotFoundError };

/**
 * Sends a ticket-purchase confirmation email.
 *
 * Trigger mechanism: an explicit endpoint the client calls after its
 * on-chain purchase transaction confirms (POST /api/events/:id/tickets/:ticketId/notify),
 * rather than polling on-chain events. The client already knows the moment
 * of success (it submitted and awaited the transaction), so this avoids
 * running a poller/indexer just to detect something the caller already knows.
 *
 * Verifies the ticket exists on-chain before emailing, but a failure to
 * *send* the email is never thrown from here as a hard error — callers
 * should treat email delivery as best-effort and never let it affect the
 * response to the on-chain action that triggered it.
 */
export async function sendTicketPurchaseConfirmation(
  eventId: number,
  ticketId: number,
  recipientEmail: string
): Promise<{ delivered: boolean; error?: string }> {
  // Throws TicketNotFoundError if the ticket doesn't exist — that's a real
  // client error (wrong id), distinct from an email provider failure.
  const ticket = await getTicketById(eventId, ticketId);

  try {
    await sendEmail({
      to: recipientEmail,
      subject: `Your ticket for event #${eventId} is confirmed`,
      html: buildTicketConfirmationHtml(eventId, ticketId, ticket),
    });
    return { delivered: true };
  } catch (err) {
    console.error(
      `Failed to send ticket confirmation email for event ${eventId}, ticket ${ticketId}:`,
      err instanceof Error ? err.message : err
    );
    return { delivered: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function buildTicketConfirmationHtml(eventId: number, ticketId: number, ticket: unknown): string {
  const owner = (ticket as { owner?: string })?.owner ?? "";
  return `
    <p>Your ticket purchase is confirmed.</p>
    <ul>
      <li>Event ID: ${eventId}</li>
      <li>Ticket ID: ${ticketId}</li>
      ${owner ? `<li>Owner: ${owner}</li>` : ""}
    </ul>
  `.trim();
}
