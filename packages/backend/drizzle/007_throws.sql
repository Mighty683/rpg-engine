CREATE TABLE IF NOT EXISTS throws (
  id uuid PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  seq bigint NOT NULL CHECK (seq > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  author_account_id uuid NOT NULL REFERENCES accounts(id),
  role text NOT NULL CHECK (role IN ('GM','Player')),
  character_id uuid,
  equipment_id uuid,
  character_name text NOT NULL,
  equipment_name text,
  kind text NOT NULL CHECK (kind IN ('attribute-check','attribute-roll','weapon-accuracy','free','opposed-check','opposed-roll')),
  setup jsonb NOT NULL,
  outcome jsonb NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  UNIQUE (game_id, seq)
);
CREATE INDEX IF NOT EXISTS throws_game_seq_idx ON throws (game_id, seq) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS throws_game_seq_all_idx ON throws (game_id, seq);
