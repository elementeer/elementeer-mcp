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
  screenshot_url: string;
  screenshot_base64?: string;
  content_hash: string;
  page_id: number;
  container_id?: string;
  captured_at: string;
}

export interface ScrapeRequest {
  page_id: number;
  container_id?: string;
}

export interface ScrapeResponse {
  screenshots?: {
    full_page?: string;
    viewport?: string;
    container?: string;
    base64?: {
      full_page?: string;
      viewport?: string;
      container?: string;
    };
  };
  content_hash?: string;
  page_id?: number;
  captured_at?: string;
}

export class BridgeClient {
  private http: AxiosInstance;
  public readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 60_000,
    });
  }

  async requestScreenshot(params: ScrapeRequest): Promise<ScreenshotResult> {
    try {
      const res = await this.http.post<ScrapeResponse>('/scrape', {
        page_id: params.page_id,
        ...(params.container_id ? { container_id: params.container_id } : {}),
      });

      const data = res.data;

      const screenshotBase64 =
        data.screenshots?.base64?.container ??
        data.screenshots?.base64?.viewport ??
        data.screenshots?.base64?.full_page ??
        undefined;

      return {
        screenshot_url:
          data.screenshots?.container ??
          data.screenshots?.viewport ??
          data.screenshots?.full_page ??
          '',
        screenshot_base64: screenshotBase64,
        content_hash: data.content_hash ?? '',
        page_id: data.page_id ?? params.page_id,
        container_id: params.container_id,
        captured_at: data.captured_at ?? new Date().toISOString(),
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

let cachedClient: BridgeClient | null = null;

export function getBridgeClient(): BridgeClient {
  if (cachedClient && bridgeUrl && cachedClient.baseUrl === bridgeUrl) {
    return cachedClient;
  }

  if (!bridgeUrl) {
    throw new BridgeError(
      'ELEMENTEER_BRIDGE_URL is not set. Screenshot/render tools are unavailable.\n' +
        'Set the environment variable to the bridge base URL (e.g. http://localhost:3000).',
      0,
    );
  }

  cachedClient = new BridgeClient(bridgeUrl);
  return cachedClient;
}

export function getBridgeUrl(): string | undefined {
  return bridgeUrl;
}
