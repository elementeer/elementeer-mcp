import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStockImageTools } from '../../tools/stock-images.js';
import type { ElementifyClient } from '../../client.js';

// ------------------------------------------------------------------ //
// Mock axios and config
// ------------------------------------------------------------------ //

vi.mock('axios', () => {
  const mockGet = vi.fn();
  return {
    default: {
      get: mockGet,
    },
    get: mockGet,
  };
});

vi.mock('../../config.js', () => ({
  getIntegrations: vi.fn().mockReturnValue({}),
}));

import axios from 'axios';
import { getIntegrations } from '../../config.js';

// ------------------------------------------------------------------ //
// Fixtures
// ------------------------------------------------------------------ //

function makePexelsResponse(count = 2) {
  return {
    data: {
      photos: Array.from({ length: count }, (_, i) => ({
        id: 100 + i,
        alt: `Office photo ${i + 1}`,
        photographer: `Photographer ${i + 1}`,
        photographer_url: `https://pexels.com/photographer-${i + 1}`,
        src: {
          original: `https://images.pexels.com/photos/${100 + i}/original.jpg`,
          large: `https://images.pexels.com/photos/${100 + i}/large.jpg`,
          small: `https://images.pexels.com/photos/${100 + i}/small.jpg`,
        },
      })),
    },
  };
}

function makeUnsplashResponse(count = 2) {
  return {
    data: {
      results: Array.from({ length: count }, (_, i) => ({
        id: `unsplash-${i}`,
        description: `Unsplash photo ${i + 1}`,
        alt_description: `Alt desc ${i + 1}`,
        user: {
          name: `UnsplashUser ${i + 1}`,
          links: { html: `https://unsplash.com/@user-${i + 1}` },
        },
        urls: {
          full: `https://images.unsplash.com/photo-${i}/full.jpg`,
          regular: `https://images.unsplash.com/photo-${i}/regular.jpg`,
          thumb: `https://images.unsplash.com/photo-${i}/thumb.jpg`,
        },
      })),
    },
  };
}

function makeClient(overrides: Partial<Record<keyof ElementifyClient, unknown>> = {}): ElementifyClient {
  return {
    sideloadImage: vi.fn().mockResolvedValue({
      id: 42,
      url: 'https://example.com/img.jpg',
      mime_type: 'image/jpeg',
      title: 'Modern office',
    }),
    ...overrides,
  } as unknown as ElementifyClient;
}

// ------------------------------------------------------------------ //
// Test setup
// ------------------------------------------------------------------ //

describe('stock image tools', () => {
  let server: McpServer;
  let client: ElementifyClient;
  let getClient: (siteId?: string) => ElementifyClient;
  let handlers: Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeClient();
    getClient = vi.fn().mockReturnValue(client);
    handlers = new Map();

    vi.spyOn(server, 'tool').mockImplementation((...args: Parameters<typeof server.tool>) => {
      handlers.set(args[0] as string, args[args.length - 1] as any);
      return server as any;
    });

    vi.mocked(getIntegrations).mockReturnValue({});
    vi.mocked(axios.get).mockReset();

    registerStockImageTools(server, getClient);
  });

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const h = handlers.get(name);
    if (!h) throw new Error(`Tool "${name}" not registered`);
    return h(args);
  };

  // ---------------------------------------------------------------- //
  // search_stock_images
  // ---------------------------------------------------------------- //
  describe('search_stock_images', () => {
    it('returns "no API key" message when no key is configured', async () => {
      vi.mocked(getIntegrations).mockReturnValue({});
      const result = await call('search_stock_images', { query: 'office' });
      const text = result.content[0]!.text;
      expect(text).toContain('No stock images found');
      expect(text).toContain('No API key configured');
    });

    it('searches Pexels when pexels_api_key is set', async () => {
      vi.mocked(getIntegrations).mockReturnValue({ pexels_api_key: 'test-pexels-key' });
      vi.mocked(axios.get).mockResolvedValueOnce(makePexelsResponse(3));

      const result = await call('search_stock_images', { query: 'modern office', source: 'pexels' });
      const text = result.content[0]!.text;

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.pexels.com/v1/search',
        expect.objectContaining({
          headers: { Authorization: 'test-pexels-key' },
          params: expect.objectContaining({ query: 'modern office' }),
        }),
      );
      expect(text).toContain('Stock Images');
      expect(text).toContain('modern office');
      expect(text).toContain('pexels');
    });

    it('searches Unsplash when unsplash_access_key is set', async () => {
      vi.mocked(getIntegrations).mockReturnValue({ unsplash_access_key: 'test-unsplash-key' });
      vi.mocked(axios.get).mockResolvedValueOnce(makeUnsplashResponse(2));

      const result = await call('search_stock_images', { query: 'nature', source: 'unsplash' });
      const text = result.content[0]!.text;

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.unsplash.com/search/photos',
        expect.objectContaining({
          headers: { Authorization: 'Client-ID test-unsplash-key' },
        }),
      );
      expect(text).toContain('unsplash');
    });

    it('falls back to Unsplash when Pexels returns no results', async () => {
      vi.mocked(getIntegrations).mockReturnValue({
        pexels_api_key: 'pexels-key',
        unsplash_access_key: 'unsplash-key',
      });
      // Pexels returns empty
      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: { photos: [] } })
        .mockResolvedValueOnce(makeUnsplashResponse(2));

      const result = await call('search_stock_images', { query: 'rare query', source: 'any' });
      const text = result.content[0]!.text;
      expect(text).toContain('unsplash');
    });

    it('uses api_key override when provided', async () => {
      vi.mocked(getIntegrations).mockReturnValue({});
      vi.mocked(axios.get).mockResolvedValueOnce(makePexelsResponse(1));

      const result = await call('search_stock_images', {
        query: 'city',
        source: 'pexels',
        api_key: 'override-key',
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.pexels.com/v1/search',
        expect.objectContaining({
          headers: { Authorization: 'override-key' },
        }),
      );
      expect(result.content[0]!.text).toContain('Stock Images');
    });

    it('includes attribution info for each result', async () => {
      vi.mocked(getIntegrations).mockReturnValue({ pexels_api_key: 'pk' });
      vi.mocked(axios.get).mockResolvedValueOnce(makePexelsResponse(2));

      const result = await call('search_stock_images', { query: 'desk', source: 'pexels' });
      const text = result.content[0]!.text;

      // Both results should have attribution lines
      expect(text).toContain('Photo by Photographer 1 on Pexels');
      expect(text).toContain('Photo by Photographer 2 on Pexels');
    });

    it('shows Large and Thumb URLs for each result', async () => {
      vi.mocked(getIntegrations).mockReturnValue({ pexels_api_key: 'pk' });
      vi.mocked(axios.get).mockResolvedValueOnce(makePexelsResponse(1));

      const result = await call('search_stock_images', { query: 'desk', source: 'pexels' });
      const text = result.content[0]!.text;

      expect(text).toContain('Large:');
      expect(text).toContain('Thumb:');
      expect(text).toContain('large.jpg');
      expect(text).toContain('small.jpg');
    });

    it('shows guidance to use sideload_stock_image', async () => {
      vi.mocked(getIntegrations).mockReturnValue({ pexels_api_key: 'pk' });
      vi.mocked(axios.get).mockResolvedValueOnce(makePexelsResponse(1));

      const result = await call('search_stock_images', { query: 'test', source: 'pexels' });
      expect(result.content[0]!.text).toContain('sideload_stock_image');
    });

    it('shows error message when API call fails', async () => {
      vi.mocked(getIntegrations).mockReturnValue({ pexels_api_key: 'pk' });
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network timeout'));

      const result = await call('search_stock_images', { query: 'fail', source: 'pexels' });
      const text = result.content[0]!.text;
      expect(text).toContain('No stock images found');
      expect(text).toContain('Network timeout');
    });
  });

  // ---------------------------------------------------------------- //
  // sideload_stock_image
  // ---------------------------------------------------------------- //
  describe('sideload_stock_image', () => {
    it('calls client.sideloadImage with correct params', async () => {
      const result = await call('sideload_stock_image', {
        url: 'https://images.pexels.com/photos/100/large.jpg',
        title: 'Office photo',
        alt_text: 'Modern office by Photographer on Pexels',
        caption: 'A modern office',
      });

      expect(client.sideloadImage).toHaveBeenCalledWith({
        url: 'https://images.pexels.com/photos/100/large.jpg',
        title: 'Office photo',
        alt_text: 'Modern office by Photographer on Pexels',
        caption: 'A modern office',
      });

      const text = result.content[0]!.text;
      expect(text).toContain('Image sideloaded');
      expect(text).toContain('ID: 42');
    });

    it('shows attachment ID in output', async () => {
      const result = await call('sideload_stock_image', {
        url: 'https://example.com/photo.jpg',
      });
      expect(result.content[0]!.text).toContain('42');
    });

    it('shows attachment URL when available', async () => {
      const result = await call('sideload_stock_image', {
        url: 'https://example.com/photo.jpg',
      });
      expect(result.content[0]!.text).toContain('https://example.com/img.jpg');
    });

    it('shows MIME type in output', async () => {
      const result = await call('sideload_stock_image', {
        url: 'https://example.com/photo.jpg',
      });
      expect(result.content[0]!.text).toContain('image/jpeg');
    });

    it('passes site_id to getClient', async () => {
      await call('sideload_stock_image', {
        url: 'https://example.com/photo.jpg',
        site_id: 'staging',
      });
      expect(getClient).toHaveBeenCalledWith('staging');
    });

    it('shows guidance about using ID with set_site_logo', async () => {
      const result = await call('sideload_stock_image', {
        url: 'https://example.com/photo.jpg',
      });
      expect(result.content[0]!.text).toContain('set_site_logo');
    });

    it('omits URL line when url is null', async () => {
      vi.mocked(client.sideloadImage).mockResolvedValueOnce({
        id: 99,
        url: null,
        mime_type: 'image/png',
        title: 'No URL',
      });

      const result = await call('sideload_stock_image', {
        url: 'https://example.com/photo.jpg',
      });
      const text = result.content[0]!.text;
      // Should not have a blank URL line — filter(Boolean) handles this
      expect(text).not.toContain('URL: null');
    });
  });
});
