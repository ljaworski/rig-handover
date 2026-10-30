import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const byJob = Object.fromEntries(night!.rows.map((r) => [r.job, r]));
    expect(byJob['fixtures/refresh']).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      first: '2026-10-29T01:30:00+01:00',
      last: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob['lane/sync']).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', owner: 'rook' });
    expect(byJob['notes/backup']).toMatchObject({ runs: 1, fails: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob['digest/render']!.owner).toBeNull();
  });

  it('returns null for a night with no file, no rows for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toBeNull();
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts lines with a bad shape instead of throwing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(dir, 'n.jsonl'),
      ['{"at":"t","job":"a","status":"ok","owner":"x"}', '{"at":"t","job":"a","status":"maybe","owner":"x"}', '[]', 'nope'].join('\n'),
    );
    expect(readNight(dir, 'n')).toMatchObject({ badLines: 3, rows: [{ job: 'a', runs: 1 }] });
  });
});
