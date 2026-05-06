-- 003_item_prices.sql — separate table for per-item snapshots.
-- Rationale: a single case has many items at the same fetched_at second.
-- Embedding into price_snapshots would force a composite key with item_name,
-- which complicates the existing /latest, /history, /movers queries that
-- assume one row per (case_id, fetched_at). Keep cases and items separated.

CREATE TABLE IF NOT EXISTS item_prices (
  case_id     TEXT NOT NULL,
  item_name   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK(kind IN ('item_high','item_low')),
  fetched_at  INTEGER NOT NULL,                                        -- unix seconds
  lowest      REAL,
  median      REAL,
  volume      INTEGER,
  PRIMARY KEY (case_id, item_name, fetched_at),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_item_case_kind_time
  ON item_prices(case_id, kind, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_name_time
  ON item_prices(item_name, fetched_at DESC);
