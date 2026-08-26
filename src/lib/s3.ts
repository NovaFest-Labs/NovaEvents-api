import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

/**
 * Lazily-created S3 client.
 * Works with any S3-compatible provider (AWS S3, Cloudflare R2, MinIO, etc.)
 * by setting S3_ENDPOINT to the provider's endpoint URL.
 */
let _client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (_client) return _client;

  const region = process.env.S3_REGION ?? "auto";
  const endpoint = process.env.S3_ENDPOINT; // optional — leave unset for AWS

  _client = new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  return _client;
}

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload a buffer to S3-compatible storage and return the public URL.
 *
 * @param key      Object key (path inside the bucket)
 * @param body     File buffer or readable stream
 * @param mimeType Content-Type header value
 */
export async function uploadToS3(
  key: string,
  body: Buffer | Readable,
  mimeType: string
): Promise<UploadResult> {
  const bucket = process.env.S3_BUCKET_NAME!;
  const client = getS3Client();

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
    },
  });

  await upload.done();

  // Build the public URL.
  // For AWS S3: https://<bucket>.s3.<region>.amazonaws.com/<key>
  // For R2/custom endpoints: <endpoint>/<bucket>/<key>
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "us-east-1";
  const publicUrl = endpoint
    ? `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  return { url: publicUrl, key };
}
