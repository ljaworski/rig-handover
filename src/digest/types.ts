// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night. Times keep the log's offset, as written.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as '—'
  runs: number;
  retries: number;
  fails: number; // ok lines = runs - retries - fails
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line, null when it has none
  first: string;
  last: string;
};

// A night that has a file. rows sorted by job; badLines = lines that didn't parse.
export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// null when runs/<night>.jsonl doesn't exist (404); an empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
