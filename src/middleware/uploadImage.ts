import multer from "multer";
import { MAX_IMAGE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "../services/imageService";
import { Request } from "express";

/**
 * Reformats a multer upload error to match imageService's friendly message
 * style. Multer's own LIMIT_FILE_SIZE error ("File too large") would
 * otherwise reach the client with a different shape than the equivalent
 * error imageService produces for the same condition.
 */
export function formatUploadImageError(err: unknown): string {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return `File too large. Maximum allowed size is ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB.`;
  }
  return err instanceof Error ? err.message : "Upload failed.";
}

/**
 * Multer middleware that accepts a single "image" field.
 * Uses memory storage so the buffer is available for direct S3 streaming
 * without writing to disk.
 *
 * File-type and size limits here act as a first-pass guard; the service
 * layer performs the authoritative validation before uploading.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type "${file.mimetype}". Allowed types: jpeg, png, webp, gif.`
        )
      );
    }
  },
}).single("image");
