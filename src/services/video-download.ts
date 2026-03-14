/**
 * Fetches a Veo-generated video with API key auth and returns a playable blob URL.
 * Veo video URIs require the API key as a header — browsers can't play them directly.
 */

const isDev = import.meta.env.DEV;
const PROXY_BASE = isDev ? '/gemini-api' : 'https://generativelanguage.googleapis.com';

// Cache blob URLs so we don't re-download
const blobCache = new Map<string, string>();

export async function fetchVideoAsBlob(
  videoUri: string,
  apiKey: string
): Promise<string> {
  const cached = blobCache.get(videoUri);
  if (cached) return cached;

  // Route through proxy in dev to avoid CORS
  let fetchUrl = videoUri;
  if (isDev && videoUri.includes('generativelanguage.googleapis.com')) {
    fetchUrl = videoUri.replace('https://generativelanguage.googleapis.com', PROXY_BASE);
  }

  const response = await fetch(fetchUrl, {
    headers: {
      'x-goog-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Video download failed: ${response.status}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  blobCache.set(videoUri, blobUrl);
  return blobUrl;
}

export function downloadVideoFile(blobUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
}
