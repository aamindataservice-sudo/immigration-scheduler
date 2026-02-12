#!/bin/bash
# Run on the SERVER after pulling code or when you see "Loading chunk failed".
# Builds the app and restarts PM2 so the running process uses the new chunks.
# Without restart, the server keeps serving OLD chunk URLs and the browser gets 404.

set -e
cd "$(dirname "$0")/.."
echo "Building..."
npm run build
echo "Restarting PM2..."
pm2 restart immigration-schedule
echo "Done. Open https://arrival.ssda.so and do a hard refresh (Ctrl+Shift+R) if needed."
