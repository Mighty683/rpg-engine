ALTER TABLE throws ADD COLUMN agent_turn_id uuid UNIQUE REFERENCES agent_turns(id) ON DELETE SET NULL;
