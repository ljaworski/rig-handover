import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
const app = createApp(config);

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error !== undefined && { error }) });

const good = [
  line('2026-10-28T23:00:02+01:00', 'zeta/sync', 'ok', 'ann'),
  line('2026-10-28T23:05:00+01:00', 'alpha/backup', 'retry', 'bob', 'timeout'),
  line('2026-10-28T23:10:00+01:00', 'alpha/backup', 'fail', 'bob', 'disk full'),
  line('2026-10-28T23:15:00+01:00', 'mid/report', 'ok', null),
];

beforeAll(() => {
  writeFileSync(join(runsDir, '2026-10-28.jsonl'), good.join('\n') + '\n');
  writeFileSync(join(runsDir, '2026-10-27.jsonl'), '');
  writeFileSync(join(runsDir, '2026-10-26.jsonl'), [good[0], 'not json {', good[1]].join('\n') + '\n');
});

describe('GET /digest/:night', () => {
  it('renders the layout with the banner and every job', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    for (const job of ['alpha/backup', 'mid/report', 'zeta/sync']) expect(html).toContain(job);
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/digest/2020-01-01')).status).toBe(404);
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app.request('/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('keeps good jobs and reports one bad line', async () => {
    const res = await app.request('/digest/2026-10-26');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('zeta/sync');
    expect(html).toContain('alpha/backup');
    expect(html).toContain("1 line didn't parse");
  });
});

describe('GET /api/digest/:night', () => {
  it('returns rows sorted by job with every field', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      night: '2026-10-28',
      badLines: 0,
      rows: [
        {
          job: 'alpha/backup',
          owner: 'bob',
          runs: 2,
          retries: 1,
          fails: 1,
          lastStatus: 'fail',
          lastError: 'disk full',
          first: '2026-10-28T23:05:00+01:00',
          last: '2026-10-28T23:10:00+01:00',
        },
        {
          job: 'mid/report',
          owner: null,
          runs: 1,
          retries: 0,
          fails: 0,
          lastStatus: 'ok',
          lastError: null,
          first: '2026-10-28T23:15:00+01:00',
          last: '2026-10-28T23:15:00+01:00',
        },
        {
          job: 'zeta/sync',
          owner: 'ann',
          runs: 1,
          retries: 0,
          fails: 0,
          lastStatus: 'ok',
          lastError: null,
          first: '2026-10-28T23:00:02+01:00',
          last: '2026-10-28T23:00:02+01:00',
        },
      ],
    });
  });

  it('404s with an error message for a night with no file', async () => {
    const res = await app.request('/api/digest/2020-01-01');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: unknown };
    expect(typeof body.error).toBe('string');
  });

  it('returns no rows and no bad lines for an empty file', async () => {
    const res = await app.request('/api/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the good rows', async () => {
    const res = await app.request('/api/digest/2026-10-26');
    const body = (await res.json()) as { rows: { job: string }[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/backup', 'zeta/sync']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-10-28')).text();
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as { rows: { job: string }[] };
    const jobs = body.rows.map((r) => r.job);
    expect(jobs.length).toBe(3);
    const at = jobs.map((j) => html.indexOf(j));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });
});
