# Compose backend entrypoint: wait for the database, apply migrations, start the dev
# server. The retry loop replaces compose health conditions, which podman-compose
# does not implement. Drizzle's journal makes rerun migrations safe.
set -eu

attempt=0
until pnpm --filter @rpg-engine/backend migrate; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "Database not ready after $attempt migration attempts; giving up." >&2
    exit 1
  fi
  echo "Database not ready yet (attempt $attempt); retrying in 2s." >&2
  sleep 2
done

exec pnpm --filter @rpg-engine/backend dev
