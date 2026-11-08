-- Run as the migration/schema owner after migrations. Set app_schema and app_role via psql -v.
-- The login role must already exist and must not own objects or inherit elevated privileges.
\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA :"app_schema" TO :"app_role";
GRANT SELECT, INSERT ON :"app_schema".accounts TO :"app_role";
GRANT SELECT, INSERT, DELETE ON :"app_schema".sessions TO :"app_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON :"app_schema".sign_in_attempts TO :"app_role";
-- UPDATE on games is also required for SELECT FOR UPDATE in the game lock.
GRANT SELECT, INSERT, UPDATE ON :"app_schema".games TO :"app_role";
GRANT SELECT, INSERT, UPDATE ON :"app_schema".players TO :"app_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON :"app_schema".characters, :"app_schema".character_classes, :"app_schema".character_skills, :"app_schema".character_equipment, :"app_schema".invitations TO :"app_role";
GRANT SELECT, INSERT ON :"app_schema".character_create_requests TO :"app_role";
GRANT SELECT, INSERT, UPDATE ON :"app_schema".throws TO :"app_role";
COMMIT;
