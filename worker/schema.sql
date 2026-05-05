-- CS2 Case Terminal — D1 schema
-- Apply with: wrangler d1 execute cs2-prices --file=schema.sql
-- For local dev:  wrangler d1 execute cs2-prices --local --file=schema.sql

CREATE TABLE IF NOT EXISTS cases (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  released      TEXT NOT NULL,                                           -- ISO date
  pool          TEXT NOT NULL CHECK(pool IN ('active','rare','discontinued')),
  rare_type     TEXT NOT NULL CHECK(rare_type IN ('Knife','Gloves')),
  has_gloves    INTEGER NOT NULL DEFAULT 0,
  notable       TEXT,
  backfilled_at INTEGER                                                  -- unix seconds when historical backfill last completed
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  case_id     TEXT NOT NULL,
  fetched_at  INTEGER NOT NULL,                                        -- unix seconds
  lowest      REAL,
  median      REAL,
  volume      INTEGER,
  PRIMARY KEY (case_id, fetched_at),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Hot path: "latest snapshot for each case" and "history for case X over window".
CREATE INDEX IF NOT EXISTS idx_snap_case_time ON price_snapshots(case_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_snap_time      ON price_snapshots(fetched_at DESC);

-- Observability: every cron run writes one row. Last few rows tell you the
-- worker's heartbeat at a glance.
CREATE TABLE IF NOT EXISTS cron_runs (
  started_at  INTEGER NOT NULL,                                     -- unix seconds
  kind        TEXT NOT NULL DEFAULT 'case'
              CHECK(kind IN ('case','item_high','item_low')),
  finished_at INTEGER,
  succeeded   INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  PRIMARY KEY (started_at, kind)
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_kind_time ON cron_runs(kind, started_at DESC);
