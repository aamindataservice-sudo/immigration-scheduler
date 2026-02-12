#!/bin/bash

# Deployment Script for arrival.ssda.so
# Run this from your LOCAL machine

echo "🚀 Immigration System Deployment to arrival.ssda.so"
echo "===================================================="
echo ""

# Configuration
SERVER="arrival.ssda.so"
SERVER_USER="administrator"  # Change this to your server username
LOCAL_DIR="/var/www/allprojects/immigration-schedule"
REMOTE_DIR="/var/www/arrival.ssda.so"

# Check if server is reachable
echo "📡 Checking server connection..."
if ! ping -c 1 $SERVER &> /dev/null; then
  echo "❌ Cannot reach $SERVER"
  echo "Please check:"
  echo "1. Server is online"
  echo "2. DNS is configured"
  echo "3. Firewall allows ping"
  exit 1
fi
echo "✅ Server is reachable"
echo ""

# Check if SSH works
echo "🔐 Testing SSH connection..."
if ! ssh -q $SERVER_USER@$SERVER exit; then
  echo "❌ Cannot SSH to $SERVER"
  echo "Please setup SSH key authentication first:"
  echo "  ssh-copy-id $SERVER_USER@$SERVER"
  exit 1
fi
echo "✅ SSH connection works"
echo ""

# Confirm deployment
echo "Ready to deploy to: $SERVER_USER@$SERVER:$REMOTE_DIR"
read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Deployment cancelled"
  exit 0
fi
echo ""

# Build locally first
echo "🔨 Building application locally..."
cd $LOCAL_DIR
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi
echo "✅ Build successful"
echo ""

# Sync files
echo "📤 Uploading files to server..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'logo_backup_*' \
  --exclude '*.md' \
  $LOCAL_DIR/ \
  $SERVER_USER@$SERVER:$REMOTE_DIR/

if [ $? -ne 0 ]; then
  echo "❌ File upload failed"
  exit 1
fi
echo "✅ Files uploaded"
echo ""

# Remote commands
echo "🔧 Configuring server..."
ssh $SERVER_USER@$SERVER << 'EOF'
cd /var/www/arrival.ssda.so

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
npx prisma generate

# Push database schema
echo "🗄️  Updating database..."
npx prisma db push

# Build application
echo "🔨 Building application on server..."
npm run build

# Restart PM2 (required after every build so chunk URLs match files on disk)
echo "🔄 Restarting application..."
if pm2 list | grep -q "immigration-schedule"; then
  pm2 restart immigration-schedule
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi

echo ""
echo "✅ Deployment complete!"
pm2 status
EOF

echo ""
echo "🎉 Deployment Successful!"
echo ""
echo "Access your site at:"
echo "  https://arrival.ssda.so"
echo ""
echo "Useful commands:"
echo "  pm2 status                        - Check app status"
echo "  pm2 logs immigration-schedule     - View logs"
echo "  pm2 restart immigration-schedule  - Restart app"
echo ""
