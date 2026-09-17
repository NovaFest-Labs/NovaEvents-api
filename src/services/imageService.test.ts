import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/stellar", () => ({ simulateContractCall: vi.fn() }));
vi.mock("../lib/s3", () => ({ uploadToS3: vi.fn() }));
vi.mock("../lib/imageStore", () => ({ setEventImageUrl: vi.fn(), getEventImageUrl: vi.fn() }));

import { simulateContractCall } from "../lib/stellar";
import { uploadToS3 } from "../lib/s3";
import { setEventImageUrl } from "../lib/imageStore";
import { EventNotFoundError } from "./eventsService";
import { uploadEventImage } from "./imageService";

const mockSimulateContractCall = vi.mocked(simulateContractCall);
const mockUploadToS3 = vi.mocked(uploadToS3);
const mockSetEventImageUrl = vi.mocked(setEventImageUrl);

const PNG_MAGIC_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_MAGIC_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF_MAGIC_BYTES = Buffer.from("GIF89a");
const WEBP_MAGIC_BYTES = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
]);

function fakeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    mimetype: "image/png",
    size: 1024,
    originalname: "cover.png",
    buffer: PNG_MAGIC_BYTES,
    ...overrides,
  } as Express.Multer.File;
}

describe("uploadEventImage", () => {
  beforeEach(() => {
    mockSimulateContractCall.mockReset();
    mockUploadToS3.mockReset();
    mockSetEventImageUrl.mockReset();
  });

  it("throws EventNotFoundError instead of uploading when the event does not exist", async () => {
    mockSimulateContractCall.mockRejectedValue(new Error("event not found"));

    await expect(uploadEventImage(999, fakeFile())).rejects.toBeInstanceOf(
      EventNotFoundError
    );
    expect(mockUploadToS3).not.toHaveBeenCalled();
  });

  it("uploads when the event exists", async () => {
    mockSimulateContractCall.mockResolvedValue({ organizer: "GABC" });
    mockUploadToS3.mockResolvedValue({ url: "https://cdn.example/x.png", key: "x.png" });

    const result = await uploadEventImage(1, fakeFile());

    expect(result.url).toBe("https://cdn.example/x.png");
    expect(mockUploadToS3).toHaveBeenCalledOnce();
  });

  it("persists the uploaded URL against the event so it can be read back later", async () => {
    mockSimulateContractCall.mockResolvedValue({ organizer: "GABC" });
    mockUploadToS3.mockResolvedValue({ url: "https://cdn.example/x.png", key: "x.png" });

    await uploadEventImage(7, fakeFile());

    expect(mockSetEventImageUrl).toHaveBeenCalledWith(7, "https://cdn.example/x.png");
  });

  describe("content sniffing", () => {
    beforeEach(() => {
      mockSimulateContractCall.mockResolvedValue({ organizer: "GABC" });
      mockUploadToS3.mockResolvedValue({ url: "https://cdn.example/x.png", key: "x.png" });
    });

    it("rejects a file whose content doesn't match its declared mimetype", async () => {
      const spoofed = fakeFile({
        mimetype: "image/png",
        buffer: Buffer.from("<script>alert(1)</script>"),
      });

      await expect(uploadEventImage(1, spoofed)).rejects.toThrow(
        /doesn't match its declared type/i
      );
      expect(mockUploadToS3).not.toHaveBeenCalled();
    });

    it("accepts a real JPEG whose content matches its declared mimetype", async () => {
      const file = fakeFile({
        mimetype: "image/jpeg",
        originalname: "cover.jpg",
        buffer: JPEG_MAGIC_BYTES,
      });

      await expect(uploadEventImage(1, file)).resolves.not.toThrow();
    });

    it("accepts a real GIF whose content matches its declared mimetype", async () => {
      const file = fakeFile({
        mimetype: "image/gif",
        originalname: "cover.gif",
        buffer: GIF_MAGIC_BYTES,
      });

      await expect(uploadEventImage(1, file)).resolves.not.toThrow();
    });

    it("accepts a real WebP whose content matches its declared mimetype", async () => {
      const file = fakeFile({
        mimetype: "image/webp",
        originalname: "cover.webp",
        buffer: WEBP_MAGIC_BYTES,
      });

      await expect(uploadEventImage(1, file)).resolves.not.toThrow();
    });

    it("rejects a file whose magic bytes match a different image type than declared", async () => {
      const mismatched = fakeFile({
        mimetype: "image/png",
        buffer: JPEG_MAGIC_BYTES,
      });

      await expect(uploadEventImage(1, mismatched)).rejects.toThrow(
        /doesn't match its declared type/i
      );
    });
  });
});
