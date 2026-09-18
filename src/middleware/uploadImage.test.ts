import { describe, it, expect, vi } from "vitest";
import multer from "multer";

// uploadImage.ts imports imageService.ts, which imports eventsService.ts,
// which constructs a real Soroban RPC client at module load time. Mock it
// the same way imageService.test.ts does, so importing formatUploadImageError
// here doesn't require real STELLAR_RPC_URL/NOVA_EVENTS_CONTRACT_ID env vars.
vi.mock("../lib/stellar", () => ({ simulateContractCall: vi.fn() }));

import { formatUploadImageError } from "./uploadImage";

describe("formatUploadImageError", () => {
  it("reformats multer's file-size error to match imageService's friendly message", () => {
    const err = new multer.MulterError("LIMIT_FILE_SIZE", "image");

    const message = formatUploadImageError(err);

    expect(message).toBe("File too large. Maximum allowed size is 5 MB.");
  });

  it("passes through the fileFilter's unsupported-type message unchanged", () => {
    const err = new Error('Unsupported file type "text/plain". Allowed types: jpeg, png, webp, gif.');

    expect(formatUploadImageError(err)).toBe(err.message);
  });

  it("falls back to a generic message for a non-Error value", () => {
    expect(formatUploadImageError("weird")).toBe("Upload failed.");
  });
});
