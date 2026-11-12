CREATE TABLE npcs (
  id uuid PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL CHECK (name = trim(name) AND char_length(name) > 0),
  relationship text NOT NULL DEFAULT 'neutral'
    CHECK (relationship IN ('enemy', 'neutral', 'friend')),
  level smallint NOT NULL CHECK (level BETWEEN 5 AND 60),
  visibility text NOT NULL DEFAULT 'hidden'
    CHECK (visibility IN ('hidden', 'visible', 'known')),
  dex_die smallint NOT NULL CHECK (dex_die IN (6, 8, 10, 12)),
  ins_die smallint NOT NULL CHECK (ins_die IN (6, 8, 10, 12)),
  mig_die smallint NOT NULL CHECK (mig_die IN (6, 8, 10, 12)),
  wlp_die smallint NOT NULL CHECK (wlp_die IN (6, 8, 10, 12)),
  current_hp integer NOT NULL CHECK (current_hp >= 0),
  max_hp integer NOT NULL CHECK (max_hp >= 0 AND current_hp <= max_hp),
  current_mp integer NOT NULL CHECK (current_mp >= 0),
  max_mp integer NOT NULL CHECK (max_mp >= 0 AND current_mp <= max_mp),
  defense integer NOT NULL CHECK (defense >= 0),
  magic_defense integer NOT NULL CHECK (magic_defense >= 0),
  notes varchar(2000) NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX npcs_game_created_idx ON npcs (game_id, created_at, id);

CREATE TABLE npc_attacks (
  id uuid PRIMARY KEY,
  npc_id uuid NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 99),
  name varchar(100) NOT NULL CHECK (name = trim(name) AND char_length(name) > 0),
  reach text NOT NULL CHECK (reach IN ('melee', 'ranged')),
  attribute_1 text NOT NULL CHECK (attribute_1 IN ('DEX', 'INS', 'MIG', 'WLP')),
  attribute_2 text NOT NULL CHECK (attribute_2 IN ('DEX', 'INS', 'MIG', 'WLP')),
  damage_bonus integer NOT NULL,
  damage_type varchar(100) NOT NULL DEFAULT '',
  CONSTRAINT npc_attacks_position_unique UNIQUE (npc_id, position)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE npc_create_requests (
  account_id uuid NOT NULL REFERENCES accounts(id),
  request_id uuid NOT NULL,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  npc_id uuid NOT NULL,
  request_body jsonb NOT NULL,
  PRIMARY KEY (account_id, request_id)
);
