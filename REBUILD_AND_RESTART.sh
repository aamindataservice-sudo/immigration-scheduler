#!/bin/bash

echo "🔄 Rebuilding and Restarting Application"
echo "========================================="
echo ""

cd /var/www/allprojects/immigration-schedule

# Stop existing process
echo "1. Stopping existing PM2 process..."
pm2 delete immigration-arrival 2>/dev/null || echo "   No existing process found"
echo ""

# Clear Next.js cache
echo "2. Clearing build cache..."
rm -rf .next
echo "   ✅ Cache cleared"
echo ""

# Install dependencies if needed
echo "3. Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi
echo "   ✅ Dependencies ready"
echo ""

# Build application
echo "4. Building application..."
npm run build
if [ $? -ne 0 ]; then
    echo "   ❌ Build failed!"
    exit 1
fi
echo "   ✅ Build successful"
echo ""

# Start with PM2
echo "5. Starting application..."
PORT=3003 pm2 start npm --name "immigration-arrival" -- start
pm2 save
echo "   ✅ Application started"
echo ""

# Wait for app to start
echo "6. Waiting for application to start..."
sleep 3
echo ""

# Test
echo "7. Testing..."
curl -s -o /dev/null -w "   HTTP Status: %{http_code}\n" http://localhost:3003
curl -s -o /dev/null -w "   Site Status: %{http_code}\n" http://arrival.ssda.so
echo ""

echo "✅ DONE!"
echo ""
pm2 status
