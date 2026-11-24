-- Runs once, on first initialization of the compose database volume, as the database
-- superuser. The passage migration requires the pgvector extension to exist already.
CREATE EXTENSION IF NOT EXISTS vector;
