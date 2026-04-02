/**
 * Fetches a Veo-generated video with API key auth and returns a playable blob URL.
 * Veo video URIs require the API key as a header — browsers can't play them directly.
 */

const isDev = import.meta.env.DEV;
const PROXY_BASE = isDev ? '/gemini-api' : 'https://generativelanguage.googleapis.com';

// Cache blob URLs so we don't re-download. Cap at 50 entries to bound memory use.
const MAX_BLOB_CACHE_SIZE = 50;
const blobCache = new Map<string, string>();

export async function fetchVideoAsBlob(
  videoUri: string,
  apiKey?: string
): Promise<string> {
  const cached = blobCache.get(videoUri);
  if (cached) return cached;

  // Route through proxy in dev to avoid CORS
  let fetchUrl = videoUri;
  if (isDev && videoUri.includes('generativelanguage.googleapis.com')) {
    fetchUrl = videoUri.replace('https://generativelanguage.googleapis.com', PROXY_BASE);
  }

  const headers: HeadersInit = {};
  if (apiKey) {
    headers['x-goog-api-key'] = apiKey;
  }

  const response = await fetch(fetchUrl, { headers });

  if (!response.ok) {
    throw new Error(`Video download failed: ${response.status}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  // Evict the oldest entry when the cache is full before inserting the new one.
  if (blobCache.size >= MAX_BLOB_CACHE_SIZE) {
    const oldestKey = blobCache.keys().next().value;
    if (oldestKey !== undefined) {
      URL.revokeObjectURL(blobCache.get(oldestKey)!);
      blobCache.delete(oldestKey);
    }
  }

  blobCache.set(videoUri, blobUrl);
  return blobUrl;
}

/** Revoke and remove a single cached blob URL to free memory immediately. */
export function revokeVideoBlob(videoUri: string): void {
  const blobUrl = blobCache.get(videoUri);
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobCache.delete(videoUri);
  }
}

/** Revoke all cached blob URLs and clear the cache. Call on project close / app teardown. */
export function clearBlobCache(): void {
  for (const blobUrl of blobCache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  blobCache.clear();
}

export function downloadVideoFile(blobUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
}
