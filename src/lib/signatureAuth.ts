/**
 * Signed-challenge headers older than this are rejected, so a captured
 * header can't be replayed later. Shared by every middleware that
 * authenticates a caller by a signed Stellar challenge, so they all enforce
 * the same window.
 */
export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
