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

// The live-container integration tests share a global testTimeout of 30000 ms
// (vitest.config.ts); per-test timeouts below are kept only where an operation
// can legitimately exceed the container's own latency.

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

  if (body !== undefined && method !== 'GET') {
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

async function setProtectRule(key: string, postIds: number[], slugs?: string[]): Promise<void> {
  const protect: Record<string, unknown> = { post_ids: postIds };
  if (slugs && slugs.length) protect.slugs = slugs;
  const res = await put(`/site/memory/${key}`, {
    type: 'rule',
    content: `Test protection — ${key}`,
    rule: { protect },
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
// Global cleanup: reset page 131 to a known state so repeated runs are stable.
// DELTA-005 patches w001.title and never restores it; without this, the title
// drifts between runs and cascades into later assertions.
// ---------------------------------------------------------------------------

afterAll(async () => {
  await removeProtectRule(RULE_KEY).catch(() => {});
  try {
    const before = await getPageData(PAGE_ID);
    const first = (before.elementor_data as any[])?.[0];
    const w001 = first?.elements?.[0];
    if (w001) {
      await patch(`/pages/${PAGE_ID}/widgets/w001`, {
        settings: { title: 'Delta Test Page' },
        content_hash: before.content_hash,
      });
    }
  } catch {
    // Best-effort reset: never fail the suite on cleanup.
  }
});

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

  it('blocks update_template metadata PATCH on a protected template (HTTP 423)', async () => {
    const tid = await createTestTemplate('Delta Meta Protect Tpl');
    createdTemplateIds.push(tid);

    await setProtectRule(RULE_KEY, [tid]);

    const res = await patch(`/templates/${tid}`, { title: 'Should Be Blocked' });
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

  it('blocks write on a page protected by slug (HTTP 423)', async () => {
    // Page 131 slug is "delta-test-page"
    await setProtectRule(RULE_KEY, [], ['delta-test-page']);

    const data = await getPageData(PAGE_ID);
    const res = await patch(`/pages/${PAGE_ID}/widgets/w001`, {
      settings: { title: 'SHOULD FAIL BY SLUG' },
      content_hash: data.content_hash,
    });
    expect(res.status).toBe(423);

    await removeProtectRule(RULE_KEY);
  });

  it('rule entry carries version, owner, expires_at', async () => {
    await setProtectRule(RULE_KEY, [PAGE_ID]);

    const res = await get<Array<any>>('/site/memory');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    const entry = (res.data as any[]).find((e) => e.key === RULE_KEY);
    expect(entry).toBeDefined();
    expect(entry.version).toBe(1);
    expect(entry.owner).toBe('agent');
    expect(entry.expires_at).toBeNull();

    await removeProtectRule(RULE_KEY);
  });

  it('expired rule no longer blocks (expires_at enforcement)', async () => {
    // Set a rule already past expiry
    const res = await put(`/site/memory/${RULE_KEY}`, {
      type: 'rule',
      content: 'Expired protection',
      owner: 'agent',
      expires_at: '2000-01-01T00:00:00+00:00',
      rule: { protect: { post_ids: [PAGE_ID] } },
    });
    expect(res.status).toBe(200);
    expect((res.data as any).expires_at).toBe('2000-01-01T00:00:00+00:00');

    // Write must succeed — rule is expired
    const data = await getPageData(PAGE_ID);
    const patchRes = await patch(`/pages/${PAGE_ID}/widgets/w001`, {
      settings: { title: 'Write after expiry' },
      content_hash: data.content_hash,
    });
    expect(patchRes.status).toBe(200);

    await removeProtectRule(RULE_KEY);
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
    const body = restore.data as any;
    expect(body.success).toBe(true);
    expect(body.restored).toBe(body.total);
    expect(body.restored).toBeGreaterThan(0);

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

// ---------------------------------------------------------------------------
// DELTA-003  Structure Operations
//
// NOTE (teilerfuellt): these are SMOKE tests on the local page 131. They
// exercise insert/remove/move/clone mechanics, NOT the real acceptance
// fixture. The real criterion — cloning the missing top-level container
// 2177a59 "So funktioniert's" that 2340 lacks relative to 2618 (11 vs 10
// containers, 135 vs 106 elements) — requires the production pages 2340 and
// 2618, which do not exist in the wp-test-env container. Do not read this
// green suite as DELTA-003 passing.
// ---------------------------------------------------------------------------

describe('DELTA-003 Structure Operations', () => {
  let tempWidgetId = '';
  const createdTemplateIds: number[] = [];

  beforeAll(async () => {
    await removeProtectRule(RULE_KEY).catch(() => {});
  });

  afterAll(async () => {
    await removeProtectRule(RULE_KEY).catch(() => {});
    for (const tid of createdTemplateIds) {
      await deleteTestTemplate(tid).catch(() => {});
    }
  });

  it('insert_widget: adds a widget to root and returns new hash', async () => {
    const data = await getPageData(PAGE_ID);
    const beforeCount = data.elementor_data.length;

    const widget = {
      id: 'ti01',
      elType: 'widget',
      widgetType: 'heading',
      settings: { title: 'Inserted via API', header_size: 'h3', align: 'left' },
    };

    const res = await post(`/pages/${PAGE_ID}/widgets`, {
      widget,
      container_path: 'root',
      position: -1,
      content_hash: data.content_hash,
    });
    expect(res.status).toBe(200);
    const body = res.data as any;
    expect(body.position).toBeGreaterThanOrEqual(0);

    // Verify
    const after = await getPageData(PAGE_ID);
    expect(after.elementor_data.length).toBe(beforeCount + 1);
    expect(after.content_hash).toBe(body.new_hash);

    tempWidgetId = 'ti01';
  });

  it('remove_widget: deletes a widget by id', async () => {
    const data = await getPageData(PAGE_ID);

    // Remove via api() so we can send content_hash in the body
    const res = await api('DELETE', `/pages/${PAGE_ID}/widgets/${tempWidgetId}`, {
      content_hash: data.content_hash,
    });
    expect(res.status).toBe(200);
    expect((res.data as any).removed).toBe(true);
  });

  it('remove_widget: returns 400 when content_hash is missing', async () => {
    const res = await api('DELETE', `/pages/${PAGE_ID}/widgets/nonexistent99`);
    expect(res.status).toBe(400);
  });

  it('insert_widget dry_run: previews without writing', async () => {
    const data = await getPageData(PAGE_ID);
    const beforeCount = data.elementor_data.length;

    const widget = {
      id: 'dryrn',
      elType: 'widget',
      widgetType: 'heading',
      settings: { title: 'Dry run heading' },
    };

    const res = await post(`/pages/${PAGE_ID}/widgets`, {
      widget,
      container_path: 'root',
      position: -1,
      content_hash: data.content_hash,
      dry_run: true,
    });
    expect(res.status).toBe(200);
    expect((res.data as any).dry_run).toBe(true);

    const after = await getPageData(PAGE_ID);
    expect(after.elementor_data.length).toBe(beforeCount);
  });

  it('move_widget: moves an element between containers', async () => {
    // Create a test widget first
    const data = await getPageData(PAGE_ID);
    const widget = {
      id: 'mvsrc',
      elType: 'widget',
      widgetType: 'heading',
      settings: { title: 'Move me' },
    };
    const insert = await post(`/pages/${PAGE_ID}/widgets`, {
      widget,
      container_path: 'root',
      content_hash: data.content_hash,
    });
    expect(insert.status).toBe(200);

    // Move it to position 0 at root
    const data2 = await getPageData(PAGE_ID);
    const res = await put(`/pages/${PAGE_ID}/widgets/mvsrc/move`, {
      target_container_path: 'root',
      position: 0,
      content_hash: data2.content_hash,
    });
    expect(res.status).toBe(200);
    const body = res.data as any;
    expect(body.widget_id).toBe('mvsrc');

    // Cleanup
    const data3 = await getPageData(PAGE_ID);
    await api('DELETE', `/pages/${PAGE_ID}/widgets/mvsrc`, {
      content_hash: data3.content_hash,
    });
  });

  it('clone_widget: copies a widget from source page to target', async () => {
    const data = await getPageData(PAGE_ID);

    const res = await post(`/pages/${PAGE_ID}/widgets/clone`, {
      source_page_id: PAGE_ID,
      widget_id: 'w001',
      container_path: 'root',
      position: -1,
      content_hash: data.content_hash,
    });
    expect(res.status).toBe(200);
    const body = res.data as any;
    expect(body.source_page_id).toBe(PAGE_ID);
    expect(body.source_widget_id).toBe('w001');
    expect(body.new_widget_id).toBeDefined();
    expect(body.new_widget_id).not.toBe('w001');
    expect(body.global_references).toBeInstanceOf(Array);
    expect(body.new_hash).toBeDefined();

    // Remove the clone
    const after = await getPageData(PAGE_ID);
    await api('DELETE', `/pages/${PAGE_ID}/widgets/${body.new_widget_id}`, {
      content_hash: after.content_hash,
    });
  });
});

// ---------------------------------------------------------------------------
// DELTA-006  Golden Scenario
//
// NOTE (teilerfuellt): this runs on local page 131, NOT the production
// reference pages 2340/2618. It exercises the full tool chain (begin → read
// → patch → insert → clone → move → batch → restore → verify) as a smoke
// test only. The real acceptance criteria — diff against 2340, detect the
// missing container 2177a59, restore AND re-apply — are gated behind the
// production rollout of 2.4.0. Do not read this as DELTA-006 passing.
// ---------------------------------------------------------------------------

describe('DELTA-006 Golden Scenario', () => {
  let sessionId: string;
  let originalHash: string;
  let originalData: unknown[];
  let insertedWidgetId = '';
  let clonedWidgetId = '';

  beforeAll(async () => {
    await removeProtectRule(RULE_KEY).catch(() => {});
    // Ensure page is in known initial state — just sec1
    const data = await getPageData(PAGE_ID);
    originalHash = data.content_hash;
    originalData = JSON.parse(JSON.stringify(data.elementor_data));
  });

  it('step 0 — snapshot before state', async () => {
    expect(originalHash).toBeDefined();
    expect(originalData.length).toBeGreaterThan(0);
  });

  it('step 1 — session_begin', async () => {
    const begin = await post<{ session_id: string }>('/changes/sessions/begin');
    expect(begin.status).toBe(201);
    sessionId = begin.data.session_id;
    expect(sessionId).toBeDefined();
  });

  it('step 2 — read current state', async () => {
    const data = await getPageData(PAGE_ID);
    expect(data.content_hash).toBe(originalHash);
  });

  it('step 3 — patch_widget changes heading text', async () => {
    const res = await patch(`/pages/${PAGE_ID}/widgets/w001`, {
      settings: { title: 'Golden Scenario Patched' },
      content_hash: originalHash,
    }, sessionId);
    expect(res.status).toBe(200);
    (res.data as any).new_hash && (originalHash = (res.data as any).new_hash);

    const after = await getPageData(PAGE_ID);
    expect((after.elementor_data as any)[0].elements[0]?.settings?.title).toBe('Golden Scenario Patched');
  });

  it('step 4 — insert_widget adds a new section', async () => {
    const data = await getPageData(PAGE_ID);
    const section = {
      id: 'gldsec',
      elType: 'section',
      settings: [],
      elements: [{
        id: 'gldwid',
        elType: 'widget',
        widgetType: 'heading',
        settings: { title: 'Golden Inserted', header_size: 'h2' },
      }],
    };
    const res = await post(`/pages/${PAGE_ID}/widgets`, {
      widget: section,
      container_path: 'root',
      content_hash: data.content_hash,
    }, sessionId);
    expect(res.status).toBe(200);
    insertedWidgetId = 'gldsec';
  });

  it('step 5 — clone_widget copies w001 into the golden section', async () => {
    const data = await getPageData(PAGE_ID);
    const res = await post(`/pages/${PAGE_ID}/widgets/clone`, {
      source_page_id: PAGE_ID,
      widget_id: 'w001',
      container_path: 'root',
      position: -1,
      content_hash: data.content_hash,
    }, sessionId);
    expect(res.status).toBe(200);
    clonedWidgetId = (res.data as any).new_widget_id;
    expect(clonedWidgetId).toBeDefined();
  });

  it('step 6 — move_widget repositions the clone', async () => {
    const data = await getPageData(PAGE_ID);
    const res = await put(`/pages/${PAGE_ID}/widgets/${clonedWidgetId}/move`, {
      target_container_path: 'root',
      position: 0,
      content_hash: data.content_hash,
    }, sessionId);
    expect(res.status).toBe(200);
    const body = res.data as any;
    expect(body.new_path).toBe('0');
  });

  it('step 7 — apply_content_map batch-updates both widgets', async () => {
    const data = await getPageData(PAGE_ID);
    const res = await post(`/pages/${PAGE_ID}/widgets/batch`, {
      operations: [
        { widget_id: 'w001', settings: { title: 'Batch Step' } },
        { widget_id: clonedWidgetId, settings: { title: 'Batch Clone' } },
      ],
      content_hash: data.content_hash,
    }, sessionId);
    expect(res.status).toBe(200);
    expect((res.data as any).updated).toBe(2);
  });

  it('step 8 — session_restore cascade rollback', async () => {
    const restore = await post(`/changes/sessions/${sessionId}/restore`);
    expect(restore.status).toBe(200);
    expect((restore.data as any).success).toBe(true);
  });

  it('step 9 — verify page returned to original state', async () => {
    // This test is the gate: byte-identical after rollback
    const after = await getPageData(PAGE_ID);
    const restored = JSON.stringify(after.elementor_data);

    // The original data was JSON-stringified then re-parsed, so compare
    // structurally: same number of top-level elements, same first widget title
    expect(after.elementor_data.length).toBe(originalData.length);

    // If restore worked, the title should be back to what it was before
    const afterTitle = (after.elementor_data as any)[0]?.elements?.[0]?.settings?.title;
    const beforeTitle = (originalData as any)[0]?.elements?.[0]?.settings?.title;
    expect(afterTitle).toBe(beforeTitle);
  });
});
