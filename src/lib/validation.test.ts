import { describe, it, expect } from "vitest";
import { isValidStellarAddress, isValidEmail } from "./validation";

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

describe("isValidEmail", () => {
  it("accepts a valid email address", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("accepts an email with subdomains", () => {
    expect(isValidEmail("user@mail.example.com")).toBe(true);
  });

  it("rejects an address missing the @ symbol", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  it("rejects an address missing the domain", () => {
    expect(isValidEmail("user@")).toBe(false);
  });

  it("rejects an address missing the TLD dot", () => {
    expect(isValidEmail("user@example")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects an address with a space in the local part", () => {
    expect(isValidEmail("us er@example.com")).toBe(false);
  });

  it("rejects an address with multiple @ symbols", () => {
    expect(isValidEmail("user@@example.com")).toBe(false);
  });
});
