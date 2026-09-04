import { describe, it, expect } from "vitest";
import { isValidStellarAddress } from "./validation";

describe("isValidStellarAddress", () => {
  it("accepts a valid Ed25519 public key", () => {
    expect(
      isValidStellarAddress(
        "GCVCPLU7JBIOIDZARACNU27LETDUJF4V4HN3KCFYE7T6KHD7SKF7IT5B"
      )
    ).toBe(true);
  });

  it("rejects a malformed address", () => {
    expect(isValidStellarAddress("not-an-address")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidStellarAddress("")).toBe(false);
  });

  it("rejects a valid-looking but checksum-invalid address", () => {
    expect(
      isValidStellarAddress(
        "GCVCPLU7JBIOIDZARACNU27LETDUJF4V4HN3KCFYE7T6KHD7SKF7IT5A"
      )
    ).toBe(false);
  });
});
