CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY,
  name varchar(20) NOT NULL CHECK (char_length(trim(name)) > 0 AND name = trim(name)),
  system_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
