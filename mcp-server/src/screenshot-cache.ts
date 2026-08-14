import type { ScreenshotResult } from './render-client.js';

interface CachedScreenshot {
  result: ScreenshotResult;
  cached_at: number;
}

const cache = new Map<string, CachedScreenshot>();

const SCREENSHOT_CACHE_TTL_MS = 5 * 60 * 1000;

export function storeScreenshot(resourceKey: string, result: ScreenshotResult): void {
  cache.set(resourceKey, {
    result,
    cached_at: Date.now(),
  });
}

export function getScreenshot(resourceKey: string): CachedScreenshot | undefined {
  const entry = cache.get(resourceKey);
  if (!entry) return undefined;

  if (Date.now() - entry.cached_at > SCREENSHOT_CACHE_TTL_MS) {
    cache.delete(resourceKey);
    return undefined;
  }

  return entry;
}

export function screenshotResourceUri(
  pageId: number,
  renderHash: string,
): string {
  return `elementeer://pages/${pageId}/screenshot/${renderHash}`;
}

export function parseScreenshotResourceUri(
  uri: string,
): { pageId: number; renderHash: string } | null {
  const match = uri.match(/^pages\/(\d+)\/screenshot\/([a-f0-9]{64})$/);
  if (!match) return null;
  return {
    pageId: parseInt(match[1], 10),
    renderHash: match[2],
  };
}

export function screenshotResourceKey(
  pageId: number,
  renderHash: string,
): string {
  return `pages/${pageId}/screenshot/${renderHash}`;
}
