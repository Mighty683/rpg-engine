CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL CHECK (char_length(trim(name)) > 0 AND name = trim(name)),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS theme varchar(200);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS level smallint NOT NULL DEFAULT 5 CHECK (level BETWEEN 5 AND 50);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS dex_die smallint NOT NULL DEFAULT 6 CHECK (dex_die IN (6,8,10,12));
ALTER TABLE characters ADD COLUMN IF NOT EXISTS ins_die smallint NOT NULL DEFAULT 6 CHECK (ins_die IN (6,8,10,12));
ALTER TABLE characters ADD COLUMN IF NOT EXISTS mig_die smallint NOT NULL DEFAULT 6 CHECK (mig_die IN (6,8,10,12));
ALTER TABLE characters ADD COLUMN IF NOT EXISTS wlp_die smallint NOT NULL DEFAULT 6 CHECK (wlp_die IN (6,8,10,12));
ALTER TABLE characters ADD COLUMN IF NOT EXISTS current_hp integer NOT NULL DEFAULT 6 CHECK (current_hp >= 0);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS current_mp integer NOT NULL DEFAULT 6 CHECK (current_mp >= 0);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS current_ip integer NOT NULL DEFAULT 6 CHECK (current_ip >= 0);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS fabula_points integer NOT NULL DEFAULT 0 CHECK (fabula_points >= 0);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS max_hp_override integer CHECK (max_hp_override IS NULL OR max_hp_override >= 0);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS max_mp_override integer CHECK (max_mp_override IS NULL OR max_mp_override >= 0);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS max_ip_override integer CHECK (max_ip_override IS NULL OR max_ip_override >= 0);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS defense_override integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS magic_defense_override integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS initiative_override integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'characters'::regclass AND conname = 'characters_player_id_id_unique') THEN
    ALTER TABLE characters ADD CONSTRAINT characters_player_id_id_unique UNIQUE (player_id,id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS characters_player_created_idx ON characters(player_id, created_at, id);
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_active_character_fk;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_active_character_fk;
ALTER TABLE players ADD CONSTRAINT players_active_character_fk FOREIGN KEY (id, active_character_id) REFERENCES characters(player_id, id);

CREATE TABLE IF NOT EXISTS character_classes (id uuid PRIMARY KEY, character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE, name varchar(100) NOT NULL CHECK (char_length(trim(name)) > 0 AND name = trim(name)), notes varchar(500) NOT NULL, position smallint NOT NULL CHECK (position IN (1,2)), UNIQUE(character_id, position));
CREATE TABLE IF NOT EXISTS character_skills (id uuid PRIMARY KEY, character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE, name varchar(100) NOT NULL CHECK (char_length(trim(name)) > 0 AND name = trim(name)), notes varchar(500) NOT NULL, position smallint NOT NULL CHECK (position BETWEEN 1 AND 100), UNIQUE(character_id, position));
CREATE TABLE IF NOT EXISTS character_equipment (id uuid PRIMARY KEY, character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE, name varchar(100) NOT NULL CHECK (char_length(trim(name)) > 0 AND name = trim(name)), notes varchar(500) NOT NULL, position smallint NOT NULL CHECK (position BETWEEN 1 AND 100), kind text NOT NULL CHECK (kind IN ('other','weapon','armor','shield')), price_zenit integer CHECK (price_zenit IS NULL OR price_zenit >= 0), equipped boolean, accuracy_attribute_1 text, accuracy_attribute_2 text, accuracy_bonus integer, fixed_defense integer, defense_bonus integer, magic_defense_bonus integer, initiative_modifier integer, UNIQUE(character_id, position));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'character_equipment'::regclass AND conname = 'character_equipment_variant_check') THEN
    ALTER TABLE character_equipment ADD CONSTRAINT character_equipment_variant_check CHECK (
      (kind = 'other' AND equipped IS NULL AND accuracy_attribute_1 IS NULL AND accuracy_attribute_2 IS NULL AND accuracy_bonus IS NULL AND fixed_defense IS NULL AND defense_bonus IS NULL AND magic_defense_bonus IS NULL AND initiative_modifier IS NULL) OR
      (kind = 'weapon' AND equipped IS NOT NULL AND fixed_defense IS NULL AND defense_bonus IS NULL AND magic_defense_bonus IS NULL AND initiative_modifier IS NULL) OR
      (kind = 'armor' AND equipped IS NOT NULL AND defense_bonus IS NOT NULL AND magic_defense_bonus IS NOT NULL AND initiative_modifier IS NOT NULL AND accuracy_attribute_1 IS NULL AND accuracy_attribute_2 IS NULL AND accuracy_bonus IS NULL) OR
      (kind = 'shield' AND equipped IS NOT NULL AND defense_bonus IS NOT NULL AND magic_defense_bonus IS NOT NULL AND initiative_modifier IS NOT NULL AND accuracy_attribute_1 IS NULL AND accuracy_attribute_2 IS NULL AND accuracy_bonus IS NULL AND fixed_defense IS NULL)
    );
  END IF;
END $$;
ALTER TABLE character_equipment ADD CONSTRAINT character_equipment_accuracy_attribute_check CHECK (accuracy_attribute_1 IS NULL OR accuracy_attribute_1 IN ('DEX','INS','MIG','WLP'));
ALTER TABLE character_equipment ADD CONSTRAINT character_equipment_accuracy_attribute_2_check CHECK (accuracy_attribute_2 IS NULL OR accuracy_attribute_2 IN ('DEX','INS','MIG','WLP'));
