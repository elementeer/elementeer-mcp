import axios, { AxiosInstance } from 'axios';

export class BridgeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly bridgeMessage?: string,
  ) {
    super(message);
    this.name = 'BridgeError';
  }
}

export interface ScreenshotResult {
  url: string;
  screenshots: {
    desktop: string;
    tablet: string;
    mobile: string;
  };
  meta: {
    title: string;
    description: string;
  };
  captured_at: string;
}

interface ScrapeScreenshotReferences {
  desktop: string;
  tablet: string;
  mobile: string;
}

interface ScrapeSummaryResponse {
  url: string;
  meta: { title: string; description: string };
  htmlLength: number;
  textBlocksCount: number;
  imagesCount: number;
  linksCount: number;
  screenshots: ScrapeScreenshotReferences;
}

export class BridgeClient {
  private http: AxiosInstance;
  public readonly baseUrl: string;
  public readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      timeout: 60_000,
    });
  }

  async requestScreenshot(pageUrl: string): Promise<ScreenshotResult> {
    try {
      const res = await this.http.post<ScrapeSummaryResponse>('/api/scrape', {
        url: pageUrl,
      });

      const data = res.data;
      const base = this.baseUrl.replace(/\/$/, '');

      return {
        url: data.url,
        screenshots: {
          desktop: `${base}${data.screenshots.desktop}`,
          tablet: `${base}${data.screenshots.tablet}`,
          mobile: `${base}${data.screenshots.mobile}`,
        },
        meta: data.meta,
        captured_at: new Date().toISOString(),
      };
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status ?? 0;
        const data = err.response?.data as Record<string, unknown> | undefined;
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : err.message;

        throw new BridgeError(
          `Bridge request failed (${status}): ${msg}`,
          status,
          msg,
        );
      }
      throw new BridgeError(
        `Bridge unreachable: ${err instanceof Error ? err.message : String(err)}`,
        0,
      );
    }
  }
}

const bridgeUrl = process.env['ELEMENTEER_BRIDGE_URL'];

const bridgeUrl = process.env['ELEMENTEER_BRIDGE_URL'];
const bridgeApiKey = process.env['ELEMENTEER_BRIDGE_API_KEY'];

let cachedClient: BridgeClient | null = null;

export function getBridgeClient(): BridgeClient {
  if (
    cachedClient &&
    bridgeUrl &&
    cachedClient.baseUrl === bridgeUrl &&
    bridgeApiKey &&
    cachedClient.apiKey === bridgeApiKey
  ) {
    return cachedClient;
  }

  if (!bridgeUrl) {
    throw new BridgeError(
      'ELEMENTEER_BRIDGE_URL is not set. Screenshot/render tools are unavailable.\n' +
        'Set the environment variable to the bridge base URL (e.g. http://localhost:3201).',
      0,
    );
  }

  if (!bridgeApiKey) {
    throw new BridgeError(
      'ELEMENTEER_BRIDGE_API_KEY is not set. Screenshot/render tools are unavailable.\n' +
        'Create an API key via POST /api/auth/keys on the bridge.',
      0,
    );
  }

  cachedClient = new BridgeClient(bridgeUrl, bridgeApiKey);
  return cachedClient;
}

export function getBridgeUrl(): string | undefined {
  return bridgeUrl;
}
