import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/stellar", () => ({ simulateContractCall: vi.fn() }));
vi.mock("../lib/s3", () => ({ uploadToS3: vi.fn() }));

import { simulateContractCall } from "../lib/stellar";
import { uploadToS3 } from "../lib/s3";
import { EventNotFoundError } from "./eventsService";
import { uploadEventImage } from "./imageService";

const mockSimulateContractCall = vi.mocked(simulateContractCall);
const mockUploadToS3 = vi.mocked(uploadToS3);

function fakeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    mimetype: "image/png",
    size: 1024,
    originalname: "cover.png",
    buffer: Buffer.from("fake"),
    ...overrides,
  } as Express.Multer.File;
}

describe("uploadEventImage", () => {
  beforeEach(() => {
    mockSimulateContractCall.mockReset();
    mockUploadToS3.mockReset();
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
});
