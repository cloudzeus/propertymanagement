import { env } from "./env";
import { logAPIUsage } from "./api-costs";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

interface UploadOptions {
  path: string; // e.g., "properties/123/logo.jpg"
  buffer: Buffer;
  contentType?: string;
}

interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

interface DeleteResponse {
  success: boolean;
  error?: string;
}

// Region code is the prefix of the S3 endpoint host (e.g. "de" from de-s3.storage.bunnycdn.com).
function s3Region(): string {
  const m = env.BUNNY_S3_ENDPOINT.match(/\/\/([a-z0-9]+)-s3\./i);
  return m ? m[1] : "de";
}

let _s3: S3Client | null = null;
function s3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      endpoint: env.BUNNY_S3_ENDPOINT,
      region: s3Region(),
      forcePathStyle: true,
      credentials: { accessKeyId: env.BUNNY_S3_ACCESS, secretAccessKey: env.BUNNY_S3_SECRET },
    });
  }
  return _s3;
}

async function uploadFile(options: UploadOptions): Promise<UploadResponse> {
  try {
    await s3().send(new PutObjectCommand({
      Bucket: env.BUNNY_STORAGE_ZONE,
      Key: options.path,
      Body: options.buffer,
      ContentType: options.contentType || "application/octet-stream",
    }));

    await logAPIUsage({ apiName: "bunnycdn", endpoint: "/s3", bytesProcessed: options.buffer.length, status: "SUCCESS" });
    return { success: true, url: `${env.BUNNY_CDN_URL}/${options.path}` };
  } catch (error) {
    console.error("BunnyCDN S3 upload error:", error);
    await logAPIUsage({ apiName: "bunnycdn", endpoint: "/s3", bytesProcessed: options.buffer.length, status: "FAILED", errorMessage: error instanceof Error ? error.message : "unknown" });
    return { success: false, error: error instanceof Error ? error.message : "Upload failed" };
  }
}

async function deleteFile(path: string): Promise<DeleteResponse> {
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: env.BUNNY_STORAGE_ZONE, Key: path }));
    await logAPIUsage({ apiName: "bunnycdn", endpoint: "/s3", status: "SUCCESS" });
    return { success: true };
  } catch (error) {
    console.error("BunnyCDN S3 delete error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Delete failed" };
  }
}

function generateSignedUrl(path: string, expiresIn: number = 3600): string {
  // BunnyCDN signed URLs require token-based authentication
  // For now, we return the public CDN URL
  // Token generation would be implemented based on BunnyCDN's authentication scheme
  return `${env.BUNNY_CDN_URL}/${path}`;
}

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  folder: string = "images"
): Promise<UploadResponse> {
  const timestamp = Date.now();
  const path = `${folder}/${timestamp}-${filename}`;

  return uploadFile({
    path,
    buffer,
    contentType: "image/jpeg", // Adjust based on actual image type
  });
}

export async function uploadDocument(
  buffer: Buffer,
  filename: string,
  folder: string = "documents"
): Promise<UploadResponse> {
  const timestamp = Date.now();
  const path = `${folder}/${timestamp}-${filename}`;

  return uploadFile({
    path,
    buffer,
    contentType: "application/pdf",
  });
}

export async function deleteFromCDN(cdnUrl: string): Promise<DeleteResponse> {
  // Extract path from CDN URL
  const path = cdnUrl.replace(env.BUNNY_CDN_URL, "").replace(/^\//, "");
  return deleteFile(path);
}

// ── Folder layout for property/building file storage ─────────────────────────
// BunnyCDN storage has no explicit "create folder" call — a folder comes into
// existence when an object is written under it. We materialise the folder by
// uploading a tiny `.keep` placeholder so it is visible/usable immediately.

export function propertyFolder(propertyId: string): string {
  return `properties/${propertyId}`;
}

export function buildingFolder(propertyId: string, buildingId: string): string {
  return `properties/${propertyId}/buildings/${buildingId}`;
}

/** Ensure a storage folder exists by writing a `.keep` placeholder inside it. */
export async function ensureFolder(folderPath: string): Promise<UploadResponse> {
  return uploadFile({
    path: `${folderPath}/.keep`,
    buffer: Buffer.from(""),
    contentType: "text/plain",
  });
}

export { uploadFile, deleteFile, generateSignedUrl };
