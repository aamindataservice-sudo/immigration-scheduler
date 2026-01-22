#!/bin/bash

# Auto-deploy script for Immigration Scheduler
cd /var/www/immigration-schedule

echo "$(date) - Starting deployment..."

# Pull latest changes
git pull origin main

# Install dependencies if package.json changed
npm install

# Run database migrations if needed
npx prisma generate
npx prisma db push --accept-data-loss 2>/dev/null || true

# Build the application
npm run build

# Restart the application
pm2 restart immigration-schedule

echo "$(date) - Deployment completed!"
