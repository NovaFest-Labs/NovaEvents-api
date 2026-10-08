import { StrKey } from "@stellar/stellar-sdk";

export function isValidStellarAddress(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

// Only accept plain non-negative decimal integers (e.g. "0", "42").
// Rejects hex ("0x1"), exponential ("1e2"), floats ("1.5"), and negatives.
const DECIMAL_INT_RE = /^\d+$/;

// event_id and ticket_id are u32 on-chain. An id past this would otherwise
// reach simulateContractCall and fail with a raw "XDR Write Error" leaking
// out as an unhandled 500 instead of a clean 400.
const U32_MAX = 4294967295;

/** Validates a route param that must fit the contract's u32 id fields (event_id, ticket_id). */
export function isValidU32Id(value: string): boolean {
  return DECIMAL_INT_RE.test(value) && Number(value) <= U32_MAX;
}
