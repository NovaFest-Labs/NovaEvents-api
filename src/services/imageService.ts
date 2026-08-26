import path from "path";
import crypto from "crypto";
import { uploadToS3, UploadResult } from "../lib/s3";

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
  // --- validation ---
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new ImageValidationError(
      `Unsupported file type "${file.mimetype}". Allowed types: jpeg, png, webp, gif.`
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

  return uploadToS3(key, file.buffer, file.mimetype);
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
