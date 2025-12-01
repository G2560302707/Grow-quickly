#!/bin/sh
set -e

# Fix permissions for mounted volumes
# We use chown to set the owner to nextjs:nodejs (uid 1001:1001)
# This requires the container to start as root (which is default)
if [ -d "/app/prisma" ]; then
    chown -R nextjs:nodejs /app/prisma
fi

if [ -d "/app/config" ]; then
    chown -R nextjs:nodejs /app/config
fi

# Execute the command as nextjs user
exec su-exec nextjs "$@"
