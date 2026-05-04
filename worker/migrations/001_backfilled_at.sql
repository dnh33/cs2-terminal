-- Migration 001: add backfilled_at tracking for historical price data import.
-- Run on existing deploys that already have the cases table:
--   wrangler d1 execute cs2-prices --file=migrations/001_backfilled_at.sql --remote
-- Safe to run multiple times — fails silently if column already exists.

ALTER TABLE cases ADD COLUMN backfilled_at INTEGER;
