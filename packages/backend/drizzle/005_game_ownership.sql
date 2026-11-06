-- Existing anonymous data has no account owner; this release requires an empty database.
ALTER TABLE games ADD COLUMN gm_account_id uuid NOT NULL REFERENCES accounts(id);

ALTER TABLE players DROP CONSTRAINT players_active_character_fk;
ALTER TABLE players ADD COLUMN account_id uuid NOT NULL REFERENCES accounts(id);
ALTER TABLE players ADD COLUMN removed boolean NOT NULL DEFAULT false;
ALTER TABLE players ADD CONSTRAINT players_game_account_unique UNIQUE (game_id, account_id);
ALTER TABLE players ADD CONSTRAINT players_game_id_id_unique UNIQUE (game_id, id);

ALTER TABLE characters DROP CONSTRAINT characters_player_id_id_unique;
ALTER TABLE characters ALTER COLUMN player_id DROP NOT NULL;
ALTER TABLE characters ADD COLUMN game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE;
ALTER TABLE characters ADD COLUMN gm_active boolean NOT NULL DEFAULT false;
ALTER TABLE characters ADD CONSTRAINT characters_game_controller_fk FOREIGN KEY (game_id, player_id) REFERENCES players(game_id, id);
ALTER TABLE characters ADD CONSTRAINT characters_game_controller_id_unique UNIQUE (game_id, player_id, id);
ALTER TABLE characters ADD CONSTRAINT characters_player_active_check CHECK (player_id IS NULL OR NOT gm_active);
ALTER TABLE players ADD CONSTRAINT players_active_character_fk FOREIGN KEY (game_id, id, active_character_id) REFERENCES characters(game_id, player_id, id);
CREATE INDEX characters_game_created_idx ON characters(game_id, created_at, id);

CREATE TABLE character_create_requests (
  account_id uuid NOT NULL REFERENCES accounts(id),
  request_id uuid NOT NULL,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  character_id uuid NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (account_id, request_id)
);
