-- 002_cron_runs_kind.sql — distinguish case vs item-tier cron runs.
-- Without this, three cron triggers (case @:05, item_high @:35, item_low @:50)
-- could collide on started_at PK if they fire in the same second under retry,
-- and "show me failed item-low runs in last 7d" can't be answered.

-- SQLite cannot ALTER PRIMARY KEY in place. Rebuild via temp table:
CREATE TABLE cron_runs_new (
  started_at  INTEGER NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'case'
              CHECK(kind IN ('case','item_high','item_low')),
  finished_at INTEGER,
  succeeded   INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  PRIMARY KEY (started_at, kind)
);

INSERT INTO cron_runs_new (started_at, kind, finished_at, succeeded, failed, error)
SELECT started_at, 'case', finished_at, succeeded, failed, error FROM cron_runs;

DROP TABLE cron_runs;
ALTER TABLE cron_runs_new RENAME TO cron_runs;

CREATE INDEX IF NOT EXISTS idx_cron_runs_kind_time ON cron_runs(kind, started_at DESC);
