CREATE TABLE invitations (
  id uuid PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('game', 'character')),
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  token_digest bytea NOT NULL UNIQUE,
  token_encrypted bytea NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'game' AND character_id IS NULL) OR (kind = 'character' AND character_id IS NOT NULL))
);
CREATE UNIQUE INDEX invitations_one_game_link ON invitations (game_id) WHERE kind = 'game';
CREATE INDEX invitations_character_id ON invitations (character_id);
