ALTER TABLE characters
  ADD COLUMN exp_current integer NOT NULL DEFAULT 50,
  ADD COLUMN exp_total integer NOT NULL DEFAULT 50,
  ADD CONSTRAINT characters_experience_check CHECK (exp_current >= 0 AND exp_total >= exp_current),
  ADD CONSTRAINT characters_game_id_unique UNIQUE (game_id, id);

CREATE TABLE character_class_levels (
  game_id uuid NOT NULL,
  character_id uuid NOT NULL,
  game_class_id uuid NOT NULL,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 10),
  PRIMARY KEY (character_id, game_class_id),
  UNIQUE (game_id, character_id, game_class_id),
  FOREIGN KEY (game_id, character_id) REFERENCES characters(game_id, id) ON DELETE CASCADE,
  FOREIGN KEY (game_id, game_class_id) REFERENCES game_classes(game_id, id) ON DELETE NO ACTION
);
CREATE INDEX character_class_levels_game_class_idx ON character_class_levels(game_id, game_class_id);

CREATE TABLE character_skill_ranks (
  game_id uuid NOT NULL,
  character_id uuid NOT NULL,
  game_class_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 10),
  PRIMARY KEY (character_id, skill_id),
  FOREIGN KEY (game_id, character_id, game_class_id)
    REFERENCES character_class_levels(game_id, character_id, game_class_id) ON DELETE CASCADE,
  FOREIGN KEY (game_id, game_class_id, skill_id)
    REFERENCES game_class_skills(game_id, game_class_id, id) ON DELETE NO ACTION
);
CREATE INDEX character_skill_ranks_game_class_idx ON character_skill_ranks(game_id, game_class_id, skill_id);
