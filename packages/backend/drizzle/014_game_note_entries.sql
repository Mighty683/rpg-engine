CREATE TABLE game_note_entries (
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  content jsonb NOT NULL CHECK (
    jsonb_typeof(content) = 'object'
    AND CASE
      WHEN jsonb_typeof(content->'ops') = 'array' THEN jsonb_array_length(content->'ops') > 0
      ELSE false
    END
  ),
  text_fingerprint text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (game_id, id),
  CHECK (updated_at >= created_at)
);

CREATE INDEX game_note_entries_page_idx ON game_note_entries (game_id, updated_at DESC, id ASC);
