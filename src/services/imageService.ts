import path from "path";
import crypto from "crypto";
import { uploadToS3, UploadResult } from "../lib/s3";
import { setEventImageUrl } from "../lib/imageStore";
import { getEventById } from "./eventsService";

/** Maximum accepted file size: 5 MB */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Accepted MIME types */
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export class ImageValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

/**
 * Validate and upload a cover image for an event.
 *
 * @param eventId  The event the image belongs to
 * @param file     The multer file object (memory storage)
 * @returns        The public URL of the uploaded image
 */
export async function uploadEventImage(
  eventId: number,
  file: Express.Multer.File
): Promise<UploadResult> {
  // Throws EventNotFoundError for a nonexistent event, before accepting the
  // upload — otherwise anyone could fill the bucket with images for event
  // IDs that don't exist.
  await getEventById(eventId);

  // --- validation ---
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new ImageValidationError(
      `Unsupported file type "${file.mimetype}". Allowed types: jpeg, png, webp, gif.`
    );
  }

  if (sniffImageType(file.buffer) !== file.mimetype) {
    throw new ImageValidationError(
      "File content doesn't match its declared type."
    );
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new ImageValidationError(
      `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum allowed size is 5 MB.`
    );
  }

  // --- build a collision-resistant key ---
  const ext = path.extname(file.originalname).toLowerCase() || mimeToExt(file.mimetype);
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  const key = `events/${eventId}/cover-${randomSuffix}${ext}`;

  const result = await uploadToS3(key, file.buffer, file.mimetype);

  // Re-uploading replaces which URL is returned for this event. The old S3
  // object is intentionally left in place rather than deleted — cleaning up
  // orphaned objects is left as a follow-up (e.g. a periodic sweep).
  setEventImageUrl(eventId, result.url);

  return result;
}

/**
 * Identifies an image's actual MIME type from its magic bytes, ignoring
 * whatever `Content-Type` the client claimed. Returns null if the buffer
 * doesn't match any type this service accepts.
 */
function sniffImageType(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 6 &&
    buffer.subarray(0, 3).toString("ascii") === "GIF" &&
    (buffer.subarray(3, 6).toString("ascii") === "87a" ||
      buffer.subarray(3, 6).toString("ascii") === "89a")
  ) {
    return "image/gif";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  return map[mime] ?? "";
}
