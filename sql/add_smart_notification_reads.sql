-- Add smart_reads column to notification_preferences
-- Stores a JSON map of smart notification ID -> ISO timestamp when marked read
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS smart_reads jsonb NOT NULL DEFAULT '{}';
