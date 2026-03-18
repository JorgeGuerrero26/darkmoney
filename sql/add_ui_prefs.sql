-- Add ui_prefs column to notification_preferences
-- Stores view modes and column visibility per module so preferences sync across devices
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS ui_prefs jsonb NOT NULL DEFAULT '{}';
