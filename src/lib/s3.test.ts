import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { s3ClientConfigs, uploadConfigs } = vi.hoisted(() => ({
  s3ClientConfigs: [] as Record<string, unknown>[],
  uploadConfigs: [] as Record<string, unknown>[],
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(config: Record<string, unknown>) {
      s3ClientConfigs.push(config);
    }
  },
}));

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class {
    params: Record<string, unknown>;
    constructor(config: Record<string, unknown>) {
      this.params = config.params as Record<string, unknown>;
      uploadConfigs.push(this.params);
    }
    async done() {}
  },
}));

const S3_ENV_KEYS = [
  "S3_REGION",
  "S3_ENDPOINT",
  "S3_BUCKET_NAME",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];

// Import s3.ts fresh so its module-level S3_REGION constant is re-evaluated
// against the env we are about to test.
async function loadS3WithEnv(env: Record<string, string>) {
  vi.resetModules();
  for (const key of S3_ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  return await import("./s3");
}

describe("s3 region handling", () => {
  beforeEach(() => {
    s3ClientConfigs.length = 0;
    uploadConfigs.length = 0;
  });

  afterEach(() => {
    for (const key of S3_ENV_KEYS) delete process.env[key];
  });

  it('falls back to the same "auto" region for both the client and the public URL', async () => {
    const { uploadToS3 } = await loadS3WithEnv({
      S3_BUCKET_NAME: "novaevents-images",
      S3_ACCESS_KEY_ID: "test-access-key",
      S3_SECRET_ACCESS_KEY: "test-secret-key",
    });

    const result = await uploadToS3(
      "events/1/cover.png",
      Buffer.from("x"),
      "image/png"
    );

    expect(s3ClientConfigs[0].region).toBe("auto");
    expect(result.url).toBe(
      "https://novaevents-images.s3.auto.amazonaws.com/events/1/cover.png"
    );
  });

  it("uses S3_REGION consistently for both the client and the public URL when set", async () => {
    const { uploadToS3 } = await loadS3WithEnv({
      S3_REGION: "eu-west-1",
      S3_BUCKET_NAME: "novaevents-images",
      S3_ACCESS_KEY_ID: "test-access-key",
      S3_SECRET_ACCESS_KEY: "test-secret-key",
    });

    const result = await uploadToS3(
      "events/1/cover.png",
      Buffer.from("x"),
      "image/png"
    );

    expect(s3ClientConfigs[0].region).toBe("eu-west-1");
    expect(result.url).toBe(
      "https://novaevents-images.s3.eu-west-1.amazonaws.com/events/1/cover.png"
    );
  });

  it("builds the public URL from S3_ENDPOINT for non-AWS providers", async () => {
    const { uploadToS3 } = await loadS3WithEnv({
      S3_ENDPOINT: "https://abc123.r2.cloudflarestorage.com/",
      S3_BUCKET_NAME: "novaevents-images",
      S3_ACCESS_KEY_ID: "test-access-key",
      S3_SECRET_ACCESS_KEY: "test-secret-key",
    });

    const result = await uploadToS3(
      "events/1/cover.png",
      Buffer.from("x"),
      "image/png"
    );

    expect(s3ClientConfigs[0]).toMatchObject({
      region: "auto",
      endpoint: "https://abc123.r2.cloudflarestorage.com/",
      forcePathStyle: true,
    });
    expect(result.url).toBe(
      "https://abc123.r2.cloudflarestorage.com/novaevents-images/events/1/cover.png"
    );
  });

  it("uploads to the configured bucket", async () => {
    const { uploadToS3 } = await loadS3WithEnv({
      S3_REGION: "us-east-1",
      S3_BUCKET_NAME: "novaevents-images",
      S3_ACCESS_KEY_ID: "test-access-key",
      S3_SECRET_ACCESS_KEY: "test-secret-key",
    });

    await uploadToS3("events/1/cover.png", Buffer.from("x"), "image/png");

    expect(uploadConfigs[0]).toMatchObject({
      Bucket: "novaevents-images",
      Key: "events/1/cover.png",
      ContentType: "image/png",
    });
  });
});
