import { describe, it, expect } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { verifyEd25519Signature } from "./signatureAuth";

describe("verifyEd25519Signature", () => {
  it("returns true for a valid signature over the exact message", () => {
    const keypair = Keypair.random();
    const message = "novaevents:notify:1:5:1720000000000";
    const signature = keypair.sign(Buffer.from(message)).toString("base64");

    expect(verifyEd25519Signature(keypair.publicKey(), message, signature)).toBe(true);
  });

  it("returns false when the signature was made over a different message", () => {
    const keypair = Keypair.random();
    const signature = keypair.sign(Buffer.from("some other message")).toString("base64");

    expect(
      verifyEd25519Signature(keypair.publicKey(), "novaevents:notify:1:5:1720000000000", signature)
    ).toBe(false);
  });

  it("returns false when the signature was made by a different keypair", () => {
    const signer = Keypair.random();
    const claimedAddress = Keypair.random();
    const message = "novaevents:notify:1:5:1720000000000";
    const signature = signer.sign(Buffer.from(message)).toString("base64");

    expect(verifyEd25519Signature(claimedAddress.publicKey(), message, signature)).toBe(false);
  });

  it("returns false instead of throwing for a malformed address", () => {
    expect(verifyEd25519Signature("not-a-valid-address", "message", "AAAA")).toBe(false);
  });

  it("returns false instead of throwing for a malformed signature", () => {
    const keypair = Keypair.random();
    expect(verifyEd25519Signature(keypair.publicKey(), "message", "not-base64!!")).toBe(false);
  });
});
