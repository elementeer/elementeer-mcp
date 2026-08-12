import type { ScreenshotResult } from './render-client.js';

interface CachedScreenshot {
  result: ScreenshotResult;
  pageId: number;
  contentHash: string;
  cached_at: number;
}

const cache = new Map<string, CachedScreenshot>();

const SCREENSHOT_CACHE_TTL_MS = 5 * 60 * 1000;

export function storeScreenshot(
  resourceKey: string,
  result: ScreenshotResult,
  pageId: number,
  contentHash: string,
): void {
  cache.set(resourceKey, {
    result,
    pageId,
    contentHash,
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
  contentHash: string,
): string {
  return `elementeer://pages/${pageId}/screenshot/${contentHash}`;
}

export function parseScreenshotResourceUri(
  uri: string,
): { pageId: number; contentHash: string } | null {
  const match = uri.match(/^pages\/(\d+)\/screenshot\/([a-g0-9-]+)$/);
  if (!match) return null;
  return {
    pageId: parseInt(match[1], 10),
    contentHash: match[2],
  };
}

export function screenshotResourceKey(
  pageId: number,
  contentHash: string,
): string {
  return `pages/${pageId}/screenshot/${contentHash}`;
}

export function buildContentHash(pageId: number, modified: string): string {
  const sanitized = modified.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  return `p${pageId}-r${sanitized}`;
}
