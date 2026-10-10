CREATE TABLE IF NOT EXISTS booking_notices (
  id serial PRIMARY KEY,
  recipient_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  boat_name text NOT NULL,
  date date NOT NULL,
  shift text NOT NULL,
  old_position integer NOT NULL,
  old_seat_label text NOT NULL,
  new_position integer,
  new_seat_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS booking_notices_recipient_created_idx
  ON booking_notices(recipient_id, created_at);
