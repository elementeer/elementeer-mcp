export interface EnvironmentClient {
  readonly apiUrl: string;
  readonly mode: string;
}

export function createEnvironmentClient(baseClient: unknown, mode = 'production'): EnvironmentClient {
  return {
    apiUrl: (baseClient && typeof baseClient === 'object' && 'apiUrl' in baseClient)
      ? String((baseClient as Record<string, unknown>).apiUrl)
      : 'http://localhost',
    mode,
  };
}
