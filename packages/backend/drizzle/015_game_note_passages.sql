-- Requires the pgvector extension (type `vector`) to be provisioned beforehand
-- with a deployment role; the application runtime role never installs extensions.
CREATE TABLE game_note_passages (
  game_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  text_fingerprint text NOT NULL,
  passage_text text NOT NULL,
  embedding vector(1024) NOT NULL,
  PRIMARY KEY (game_id, entry_id, ordinal),
  FOREIGN KEY (game_id, entry_id)
    REFERENCES game_note_entries (game_id, id)
    ON DELETE CASCADE
);
