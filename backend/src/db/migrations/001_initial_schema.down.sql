-- ============================================================================
-- Migration 001 (DOWN): Drop Core Schema Tables in Reverse Dependency Order
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS users CASCADE;

COMMIT;

