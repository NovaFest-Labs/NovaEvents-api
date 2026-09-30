import { Keypair } from "@stellar/stellar-sdk";

/**
 * Signed-challenge headers older than this are rejected, so a captured
 * header can't be replayed later. Shared by every middleware that
 * authenticates a caller by a signed Stellar challenge, so they all enforce
 * the same window.
 */
export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Verifies an ed25519 signature over `message`, claimed to be made by
 * `address`. Returns false (rather than throwing) for a malformed address,
 * a malformed signature, or a signature that doesn't match — every
 * signed-challenge middleware in this codebase relies on this single
 * implementation so the actual cryptographic check only lives in one place.
 */
export function verifyEd25519Signature(
  address: string,
  message: string,
  signatureBase64: string
): boolean {
  try {
    return Keypair.fromPublicKey(address).verify(
      Buffer.from(message),
      Buffer.from(signatureBase64, "base64")
    );
  } catch {
    return false;
  }
}
