import axios, { AxiosInstance } from 'axios';

// ElementorTemplate contract mirrors elementeer-bridge packages/contracts/src/elementor.ts.
// It is duplicated here (not imported) because the MCP does not depend on the
// bridge's package. The `type` union is the single source of truth on the
// bridge side; the MCP only ever sends "page" for a rendered page (the
// request_screenshot tool renders a page, not a header/footer/popup).
export type TemplateType =
  | 'page'
  | 'header'
  | 'footer'
  | 'popup'
  | 'section'
  | 'single'
  | 'archive'
  | 'product'
  | 'product-archive';

export interface ElementorElement {
  id: string;
  elType: 'container' | 'widget' | 'section' | 'column';
  isInner: boolean;
  settings: Record<string, unknown>;
  elements: ElementorElement[];
  widgetType?: string;
}

export interface ElementorTemplate {
  title: string;
  type: TemplateType;
  version: '0.4';
  page_settings: Record<string, unknown>;
  content: ElementorElement[];
}

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

export interface ScreenshotViewports {
  desktop: string;
  tablet: string;
  mobile: string;
}

export interface ScreenshotResult {
  pageId: number;
  renderHash: string;
  screenshots: ScreenshotViewports;
  capturedAt: string;
}

export interface ScreenshotRequest {
  pageId: number;
  template: ElementorTemplate;
  renderHash?: string;
  containers?: string[];
}

interface BridgeScreenshotResponse {
  pageId: number;
  renderHash: string;
  screenshots: {
    desktop: string;
    tablet: string;
    mobile: string;
  };
  capturedAt: string;
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

  async requestScreenshot(params: ScreenshotRequest): Promise<ScreenshotResult> {
    try {
      const body: Record<string, unknown> = {
        template: params.template,
      };
      if (params.renderHash) body.renderHash = params.renderHash;
      if (params.containers?.length) body.containers = params.containers;

      const res = await this.http.post<BridgeScreenshotResponse>(
        `/api/pages/${params.pageId}/screenshots`,
        body,
      );

      const data = res.data;
      const base = this.baseUrl.replace(/\/$/, '');

      const prefix = `/static/page-screenshots/${data.pageId}/${data.renderHash}`;

      return {
        pageId: data.pageId,
        renderHash: data.renderHash,
        screenshots: {
          desktop: `${base}${prefix}/desktop.png`,
          tablet: `${base}${prefix}/tablet.png`,
          mobile: `${base}${prefix}/mobile.png`,
        },
        capturedAt: data.capturedAt,
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
