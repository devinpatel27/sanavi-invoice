import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { BlobServiceClient } from "@azure/storage-blob";

let cachedClient: BlobServiceClient | null = null;

function getBlobServiceClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "AZURE_STORAGE_CONNECTION_STRING is not set. Provision Azure Blob Storage and add it to .env."
    );
  }
  if (!cachedClient) {
    cachedClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return cachedClient;
}

export function isBlobStorageConfigured() {
  return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING?.trim());
}

async function uploadInvoiceFileLocal(
  filename: string,
  contents: Buffer
): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blobName = `${Date.now()}-${safeName}`;
  const dir = path.join(process.cwd(), ".data", "uploads");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, blobName);
  await writeFile(filePath, contents);
  // App-relative path — not a public URL; used for audit / re-read.
  return `local://.data/uploads/${blobName}`;
}

async function uploadInvoiceFileAzure(
  filename: string,
  contents: Buffer,
  contentType: string
): Promise<string> {
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME ?? "invoices";
  const serviceClient = getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blobName = `${Date.now()}-${safeName}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(contents, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

/**
 * Uploads a file buffer to Azure Blob when configured; otherwise stores it
 * under `.data/uploads` for local/dev so Document Intelligence can still run.
 */
export async function uploadInvoiceFile(
  filename: string,
  contents: Buffer,
  contentType: string
): Promise<string> {
  if (isBlobStorageConfigured()) {
    return uploadInvoiceFileAzure(filename, contents, contentType);
  }
  return uploadInvoiceFileLocal(filename, contents);
}
