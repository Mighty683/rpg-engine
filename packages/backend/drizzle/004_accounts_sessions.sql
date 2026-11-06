CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  username text NOT NULL CHECK (username <> '' AND username = trim(username)),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX accounts_username_normalized ON accounts (lower(username));

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_digest bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_account_id ON sessions (account_id);

CREATE TABLE sign_in_attempts (
  identifier_digest bytea PRIMARY KEY,
  attempts integer NOT NULL,
  window_started_at timestamptz NOT NULL
);
