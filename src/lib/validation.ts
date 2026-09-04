import { StrKey } from "@stellar/stellar-sdk";

export function isValidStellarAddress(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value);
}
