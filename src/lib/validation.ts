import { StrKey } from "@stellar/stellar-sdk";

export function isValidStellarAddress(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}
