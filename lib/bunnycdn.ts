import { env } from "./env";

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

async function uploadFile(options: UploadOptions): Promise<UploadResponse> {
  try {
    const url = `https://ny.storage.bunnycdn.com/${env.BUNNY_STORAGE_ZONE}/${options.path}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        AccessKey: env.BUNNY_API_KEY,
        "Content-Type": options.contentType || "application/octet-stream",
      },
      body: options.buffer,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("BunnyCDN upload error:", error);
      return {
        success: false,
        error: `Upload failed: ${response.status}`,
      };
    }

    const cdnUrl = `${env.BUNNY_CDN_URL}/${options.path}`;
    return {
      success: true,
      url: cdnUrl,
    };
  } catch (error) {
    console.error("BunnyCDN error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function deleteFile(path: string): Promise<DeleteResponse> {
  try {
    const url = `https://ny.storage.bunnycdn.com/${env.BUNNY_STORAGE_ZONE}/${path}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        AccessKey: env.BUNNY_API_KEY,
      },
    });

    if (!response.ok) {
      console.error("BunnyCDN delete error:", response.status);
      return {
        success: false,
        error: `Delete failed: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("BunnyCDN error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
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

export { uploadFile, deleteFile, generateSignedUrl };
