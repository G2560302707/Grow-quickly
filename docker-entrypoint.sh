#!/bin/sh
set -e

# Define paths
SOURCE_DB="/app/prisma/dev.db"
TARGET_DB="/app/data/dev.db"
SEED_MARKER="/app/data/.seed_completed"
# Use globally installed Prisma CLI
PRISMA_BIN="prisma"

# Fix permissions for data and config directories
chown -R nextjs:nodejs /app/data /app/config

# Check if the persistent database exists
if [ ! -f "$TARGET_DB" ]; then
    echo "[Entrypoint] Initializing database..."
    if [ -f "$SOURCE_DB" ]; then
        echo "[Entrypoint] Copying pre-packaged database from $SOURCE_DB to $TARGET_DB"
        cp "$SOURCE_DB" "$TARGET_DB"
        # Ensure correct permissions
        chown nextjs:nodejs "$TARGET_DB"
        # Mark as seeded since pre-packaged DB includes seed data
        touch "$SEED_MARKER"
    else
        echo "[Entrypoint] Warning: Source database not found at $SOURCE_DB. Skipping initialization."
    fi
else
    echo "[Entrypoint] Database already exists at $TARGET_DB."
    # Run migrations to ensure DB schema is up to date with new code version
    echo "[Entrypoint] Running database migrations to sync schema..."
    cd /app && $PRISMA_BIN migrate deploy --schema=./prisma/schema.prisma && {
        echo "[Entrypoint] Migrations completed successfully."
        
        # Check if seed has been run (for upgrades from older versions)
        if [ ! -f "$SEED_MARKER" ]; then
            echo "[Entrypoint] First-time upgrade detected. Running database seed to populate system tags..."
            cd /app && $PRISMA_BIN db seed && {
                echo "[Entrypoint] Seed completed successfully."
                touch "$SEED_MARKER"
            } || echo "[Entrypoint] Seed failed or already populated."
        fi
    } || echo "[Entrypoint] Migration failed or no pending migrations."
fi

# Execute the main container command as nextjs user
exec su-exec nextjs:nodejs "$@"


