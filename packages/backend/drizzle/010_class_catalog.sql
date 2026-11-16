CREATE TABLE class_templates (
    id uuid PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    system_id text NOT NULL CHECK (system_id = 'fabula-ultima'),
    revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
    definition jsonb NOT NULL
);
CREATE INDEX class_templates_account_idx ON class_templates(account_id, id);

CREATE TABLE game_classes (
    id uuid PRIMARY KEY,
    game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    system_id text NOT NULL CHECK (system_id = 'fabula-ultima'),
    revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
    name text NOT NULL,
    description text NOT NULL,
    free_benefits jsonb NOT NULL,
    UNIQUE (game_id, id)
);

CREATE TABLE game_class_skills (
    id uuid PRIMARY KEY,
    game_class_id uuid NOT NULL,
    game_id uuid NOT NULL,
    position integer NOT NULL CHECK (position >= 0),
    name text NOT NULL,
    description text NOT NULL,
    max_rank integer NOT NULL CHECK (max_rank > 0),
    benefits jsonb NOT NULL,
    UNIQUE (game_id, game_class_id, id),
    FOREIGN KEY (game_id, game_class_id) REFERENCES game_classes(game_id, id) ON DELETE CASCADE
);
CREATE INDEX game_class_skills_order_idx ON game_class_skills(game_id, game_class_id, position);

-- Receipts outlive their result to prevent a stale retry from recreating a removed class.
CREATE TABLE class_create_requests (
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    intent jsonb NOT NULL,
    PRIMARY KEY (request_id)
);
