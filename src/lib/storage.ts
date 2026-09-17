import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Document storage, kept behind this interface so production can swap the
 * local MinIO (S3-compatible) implementation for SharePoint/OneDrive via
 * Microsoft Graph (drive items: PUT /drives/{id}/items/{id}/content to
 * upload, GET .../content or a preview URL to read) without touching any
 * caller in src/lib/data/documents.ts or the upload/download routes.
 */
export interface DownloadUrlOptions {
  /** Forces "Save As" with this filename; omit for inline (browser-native PDF viewer, etc.). */
  downloadFilename?: string;
}

export interface StorageAdapter {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Signed, time-limited URL — never serve documents from a public path. */
  getDownloadUrl(key: string, expiresInSeconds?: number, options?: DownloadUrlOptions): Promise<string>;
  getObject(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? "dsac-documents";
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }

  async upload(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async getDownloadUrl(key: string, expiresInSeconds = 300, options?: DownloadUrlOptions) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: options?.downloadFilename
          ? `attachment; filename="${options.downloadFilename.replace(/"/g, "")}"`
          : "inline",
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

export const storage: StorageAdapter = new S3StorageAdapter();
