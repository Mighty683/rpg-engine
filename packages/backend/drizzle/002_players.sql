CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name varchar(20) NOT NULL CHECK (char_length(trim(name)) > 0 AND name = trim(name)),
  active_character_id uuid NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS players_game_created_idx ON players(game_id, created_at, id);
