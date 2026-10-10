-- Preserve every existing launch and reservation, assigning untimed launches
-- to the morning shift. Apply before starting the shift-aware API.
BEGIN;
ALTER TABLE launches ADD COLUMN IF NOT EXISTS shift text NOT NULL DEFAULT '08:00';
ALTER TABLE launches DROP CONSTRAINT IF EXISTS launch_boat_date_unique;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'launch_boat_date_shift_unique' AND conrelid = 'launches'::regclass) THEN
    ALTER TABLE launches ADD CONSTRAINT launch_boat_date_shift_unique UNIQUE (boat_id, date, shift);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'launch_shift_valid' AND conrelid = 'launches'::regclass) THEN
    ALTER TABLE launches ADD CONSTRAINT launch_shift_valid CHECK (shift IN ('08:00', '13:00'));
  END IF;
END $$;
COMMIT;
