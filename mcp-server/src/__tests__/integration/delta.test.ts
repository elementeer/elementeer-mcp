/**
 * ELM-DELTA integration tests.
 *
 * Every test hits the live wp-test-env container at localhost:8082.
 * No MSW mocks — real HTTP request/response cycles against the installed
 * Elementeer plugin on branch feature/ELM-DELTA-plugin-endpoints.
 *
 * Run with:  npx vitest run src/__tests__/integration/delta.test.ts
 *
 * Prerequisites:
 *   - Docker container wptesting-wordpress running on port 8082
 *   - Plugin includes deployed from feature/ELM-DELTA-plugin-endpoints
 *   - Page 131 exists with an Elementor heading widget "w001"
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:8082/wp-json/elementeer/v1';
const API_KEY = 'ek_08f7d1c11d303bad402ea160b50cea24dbf59f18846c3e44';

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  sessionId?: string,
): Promise<ApiResponse<T>> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = {
    'X-Elementeer-Key': API_KEY,
    Accept: 'application/json',
  };
  if (sessionId) {
    headers['X-Elementeer-Session'] = sessionId;
  }
  const init: RequestInit = { method, headers };

  if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
    init.body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = text as unknown as T;
  }
  return { ok: res.ok, status: res.status, data };
}

async function get<T = unknown>(path: string): Promise<ApiResponse<T>> {
  return api<T>('GET', path);
}

async function post<T = unknown>(path: string, body?: unknown, sessionId?: string): Promise<ApiResponse<T>> {
  return api<T>('POST', path, body, sessionId);
}

async function put<T = unknown>(path: string, body?: unknown, sessionId?: string): Promise<ApiResponse<T>> {
  return api<T>('PUT', path, body, sessionId);
}

async function patch<T = unknown>(path: string, body?: unknown, sessionId?: string): Promise<ApiResponse<T>> {
  return api<T>('PATCH', path, body, sessionId);
}

async function del<T = unknown>(path: string): Promise<ApiResponse<T>> {
  return api<T>('DELETE', path);
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

async function createTestTemplate(title: string): Promise<number> {
  const res = await post<{ id: number }>('/templates', {
    title,
    type: 'section',
    status: 'publish',
  });
  if (!res.ok) throw new Error(`Failed to create template: ${res.status} ${JSON.stringify(res.data)}`);
  return (res.data as { id: number }).id;
}

async function deleteTestTemplate(id: number): Promise<void> {
  await del(`/templates/${id}?force=true`);
}

async function setProtectRule(key: string, postIds: number[]): Promise<void> {
  const res = await put(`/site/memory/${key}`, {
    type: 'rule',
    content: `Test protection — ${key}`,
    rule: { protect: { post_ids: postIds } },
  });
  if (!res.ok) throw new Error(`Failed to set protect rule: ${res.status}`);
}

async function removeProtectRule(key: string): Promise<void> {
  await del(`/site/memory/${key}`);
}

async function getPageData(pageId: number): Promise<{ content_hash: string; elementor_data: unknown[] }> {
  const res = await get<{ content_hash: string; elementor_data: unknown[] }>(`/pages/${pageId}/data`);
  if (!res.ok) throw new Error(`Failed to get page data: ${res.status}`);
  return res.data as { content_hash: string; elementor_data: unknown[] };
}

const PAGE_ID = 131;   // pre-existing test page with heading w001
const RULE_KEY = 'delta-test-protect';

// ---------------------------------------------------------------------------
// DELTA-005  Protection enforcement
// ---------------------------------------------------------------------------

describe('DELTA-005 Protection enforcement', () => {
  const createdTemplateIds: number[] = [];

  afterAll(async () => {
    // Ensure protection is removed before cleanup
    await removeProtectRule(RULE_KEY).catch(() => {});
    for (const tid of createdTemplateIds) {
      await deleteTestTemplate(tid).catch(() => {});
    }
  });

  it('blocks PATCH widget on a protected page (HTTP 423)', async () => {
    // Protect page 131
    await setProtectRule(RULE_KEY, [PAGE_ID]);

    // Try to patch — expect 423
    const res = await patch(`/pages/${PAGE_ID}/widgets/w001`, {
      settings: { title: 'SHOULD FAIL' },
      content_hash: 'any-hash',
    });
    expect(res.status).toBe(423);

    // Remove protection for subsequent tests
    await removeProtectRule(RULE_KEY);
  });

  it('blocks PATCH widget on a protected template (HTTP 423)', async () => {
    const tid = await createTestTemplate('Delta Protect Test Tpl');
    createdTemplateIds.push(tid);

    await setProtectRule(RULE_KEY, [tid]);

    const res = await patch(`/templates/${tid}/widgets/w001`, {
      settings: { title: 'SHOULD FAIL' },
      content_hash: 'any-hash',
    });
    expect(res.status).toBe(423);

    await removeProtectRule(RULE_KEY);
  });

  it('blocks update_template_data on a protected template (HTTP 423)', async () => {
    const tid = await createTestTemplate('Delta Protect Data Tpl');
    createdTemplateIds.push(tid);

    await setProtectRule(RULE_KEY, [tid]);

    const res = await put(`/templates/${tid}/data`, { elementor_data: [] });
    expect(res.status).toBe(423);

    await removeProtectRule(RULE_KEY);
  });

  it('blocks delete_template on a protected template (HTTP 423)', { timeout: 15000 }, async () => {
    const tid = await createTestTemplate('Delta Protect Delete Tpl');
    createdTemplateIds.push(tid);

    await setProtectRule(RULE_KEY, [tid]);

    const res = await del(`/templates/${tid}?force=true`);
    expect(res.status).toBe(423);

    await removeProtectRule(RULE_KEY);
  });

  it('allows writes after protection is removed', { timeout: 15000 }, async () => {
    const tid = await createTestTemplate('Delta Unprotect Tpl');
    createdTemplateIds.push(tid);

    // Protect, then remove
    await setProtectRule(RULE_KEY, [tid]);
    await removeProtectRule(RULE_KEY);

    // Now delete should succeed
    const res = await del(`/templates/${tid}?force=true`);
    expect(res.status).toBe(200);

    // Cleanup: template already deleted, remove from tracking
    createdTemplateIds.pop();
  });

  it('unprotected page remains writable', async () => {
    const data = await getPageData(PAGE_ID);

    const res = await patch(`/pages/${PAGE_ID}/widgets/w001`, {
      settings: { title: 'Unprotected Write' },
      content_hash: data.content_hash,
    });
    expect(res.status).toBe(200);
    expect((res.data as any).updated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DELTA-004  Change Sessions
// ---------------------------------------------------------------------------

describe('DELTA-004 Change Sessions', () => {
  const createdTemplateIds: number[] = [];

  afterAll(async () => {
    for (const tid of createdTemplateIds) {
      await deleteTestTemplate(tid).catch(() => {});
    }
  });

  it('begin session returns a session_id', async () => {
    const res = await post<{ session_id: string; status: string }>('/changes/sessions/begin');
    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('session_id');
    expect((res.data as any).status).toBe('active');
  });

  it('end session returns ended status', async () => {
    const begin = await post<{ session_id: string }>('/changes/sessions/begin');
    const sid = (begin.data as any).session_id;

    const end = await post(`/changes/sessions/${sid}/end`);
    expect(end.status).toBe(200);
    expect((end.data as any).status).toBe('ended');
  });

  it('get session returns session data', async () => {
    const begin = await post<{ session_id: string }>('/changes/sessions/begin');
    const sid = (begin.data as any).session_id;

    const detail = await get(`/changes/sessions/${sid}`);
    expect(detail.status).toBe(200);
    expect((detail.data as any).session_id).toBe(sid);
  });

  it('restore rolls back writes within the session', { timeout: 15000 }, async () => {
    // Read the current title — this is the value we expect after rollback
    const dataBefore = await getPageData(PAGE_ID);
    const originalTitle = (dataBefore.elementor_data as any)[0]
      .elements[0]?.settings?.title;

    const begin = await post<{ session_id: string }>('/changes/sessions/begin');
    const sid = (begin.data as any).session_id;

    // Make a write WITH the session header so it attaches
    await patch(`/pages/${PAGE_ID}/widgets/w001`, {
      settings: { title: 'SESSION WRITE' },
      content_hash: dataBefore.content_hash,
    }, sid);

    // Verify title DID change
    const dataAfter = await getPageData(PAGE_ID);
    const changedTitle = (dataAfter.elementor_data as any)[0]
      .elements[0]?.settings?.title;
    expect(changedTitle).toBe('SESSION WRITE');

    // Restore session
    const restore = await post(`/changes/sessions/${sid}/restore`);
    expect(restore.status).toBe(200);
    expect((restore.data as any).success).toBe(true);

    // Verify title is back to original (before session)
    const dataRestored = await getPageData(PAGE_ID);
    const restoredTitle = (dataRestored.elementor_data as any)[0]
      .elements[0]?.settings?.title;
    expect(restoredTitle).toBe(originalTitle);
  });

  it('a write without session header does not attach to the open session', { timeout: 15000 }, async () => {
    // Two sessions simultaneously open — write with neither header,
    // verify restore of both sessions reports 0 snapshots
    const begin = await post('/changes/sessions/begin');
    const sid = (begin.data as any).session_id;

    // Write WITHOUT session header
    const dataBefore = await getPageData(PAGE_ID);
    await patch(`/pages/${PAGE_ID}/widgets/w001`, {
      settings: { title: 'NO SESSION' },
      content_hash: dataBefore.content_hash,
    });
    // No session header → snapshot not attached

    const restore = await post(`/changes/sessions/${sid}/restore`);
    expect(restore.status).toBe(200);
    const body = restore.data as any;
    expect(body.success).toBe(true);
    // 0 snapshots in this session — the write was not attached
    expect(body.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// DELTA-002  Batch widget patch
// ---------------------------------------------------------------------------

describe('DELTA-002 Batch widget patch', () => {
  it('success: patches multiple widgets', async () => {
    const data = await getPageData(PAGE_ID);

    const res = await post(`/pages/${PAGE_ID}/widgets/batch`, {
      operations: [
        { widget_id: 'w001', settings: { title: 'Batch Title' } },
      ],
      content_hash: data.content_hash,
    });
    expect(res.status).toBe(200);
    const body = res.data as any;
    expect(body.post_id).toBe(PAGE_ID);
    expect(body.updated).toBe(1);
    expect(body.not_found).toEqual([]);

    // Verify
    const after = await getPageData(PAGE_ID);
    const title = (after.elementor_data as any)[0].elements[0]?.settings?.title;
    expect(title).toBe('Batch Title');
  });

  it('dry_run returns preview without writing', async () => {
    const data = await getPageData(PAGE_ID);
    const currentTitle = (data.elementor_data as any)[0].elements[0]?.settings?.title;

    const res = await post(`/pages/${PAGE_ID}/widgets/batch`, {
      operations: [
        { widget_id: 'w001', settings: { title: 'DRY RUN' } },
      ],
      content_hash: data.content_hash,
      dry_run: true,
    });
    expect(res.status).toBe(200);
    const body = res.data as any;
    expect(body.operation_count).toBe(1);

    // Verify NOT written
    const after = await getPageData(PAGE_ID);
    const title = (after.elementor_data as any)[0].elements[0]?.settings?.title;
    expect(title).toBe(currentTitle);
  });

  it('stale content_hash returns 409', async () => {
    const res = await post(`/pages/${PAGE_ID}/widgets/batch`, {
      operations: [
        { widget_id: 'w001', settings: { title: 'ANY' } },
      ],
      content_hash: '0000000000deadbeef',
    });
    expect(res.status).toBe(409);
  });

  it('unknown widget_id returns 404 when partial not set', async () => {
    const data = await getPageData(PAGE_ID);

    const res = await post(`/pages/${PAGE_ID}/widgets/batch`, {
      operations: [
        { widget_id: 'nonexistent', settings: { title: 'Bad' } },
      ],
      content_hash: data.content_hash,
    });
    expect(res.status).toBe(404);
  });

  it('batch on a protected page fails entirely (HTTP 423)', async () => {
    const data = await getPageData(PAGE_ID);

    // Protect page
    await setProtectRule(RULE_KEY, [PAGE_ID]);

    const res = await post(`/pages/${PAGE_ID}/widgets/batch`, {
      operations: [
        { widget_id: 'w001', settings: { title: 'SHOULD FAIL' } },
      ],
      content_hash: data.content_hash,
    });
    expect(res.status).toBe(423);

    await removeProtectRule(RULE_KEY);
  });
});
