CREATE TABLE agent_turns (
  id uuid PRIMARY KEY,
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  gm_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  author text NOT NULL,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000 AND message = btrim(message)),
  reply text NOT NULL CHECK (char_length(reply) BETWEEN 1 AND 6000),
  tools jsonb NOT NULL CHECK (jsonb_typeof(tools) = 'array' AND jsonb_array_length(tools) <= 10)
);

CREATE INDEX agent_turns_transcript_idx ON agent_turns (game_id, gm_account_id, sequence DESC);
