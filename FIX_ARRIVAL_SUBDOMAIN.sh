#!/bin/bash

echo "🔧 Fixing arrival.ssda.so to point to /var/www/allprojects/immigration-schedule"
echo "=============================================================================="
echo ""

# Stop any running immigration-arrival process
echo "1. Stopping old process..."
pm2 delete immigration-arrival 2>/dev/null || echo "   No old process found"
echo ""

# Update Apache config to point to allprojects directory
echo "2. Updating Apache configuration..."
sudo tee /etc/apache2/sites-available/arrival.ssda.so.conf > /dev/null << 'EOF'
<VirtualHost *:80>
    ServerName arrival.ssda.so
    ServerAlias www.arrival.ssda.so
    
    # Document root for static files (if needed)
    DocumentRoot /var/www/allprojects/immigration-schedule/public
    
    # Proxy settings
    ProxyPreserveHost On
    ProxyPass /uploads !
    ProxyPass / http://localhost:3003/
    ProxyPassReverse / http://localhost:3003/
    
    # Serve uploaded files directly
    <Directory /var/www/allprojects/immigration-schedule/public/uploads>
        Options FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>
    
    Alias /uploads /var/www/allprojects/immigration-schedule/public/uploads
    
    # Logs
    ErrorLog ${APACHE_LOG_DIR}/arrival.ssda.so-error.log
    CustomLog ${APACHE_LOG_DIR}/arrival.ssda.so-access.log combined
</VirtualHost>
EOF

echo "   ✅ Apache config updated"
echo ""

# Test Apache configuration
echo "3. Testing Apache configuration..."
sudo apachectl configtest
if [ $? -eq 0 ]; then
    echo "   ✅ Apache config is valid"
else
    echo "   ❌ Apache config has errors - please check"
    exit 1
fi
echo ""

# Reload Apache
echo "4. Reloading Apache..."
sudo systemctl reload apache2
echo "   ✅ Apache reloaded"
echo ""

# Create .env if it doesn't exist
echo "5. Creating/updating .env file..."
cat > /var/www/allprojects/immigration-schedule/.env << 'ENVEOF'
DATABASE_URL="file:/var/lib/immigration-schedule/prod.db"
NODE_ENV=production
ENVEOF

chmod 600 /var/www/allprojects/immigration-schedule/.env
echo "   ✅ .env file created"
echo ""

# Start application from correct directory
echo "6. Starting application..."
cd /var/www/allprojects/immigration-schedule
PORT=3003 pm2 start npm --name "immigration-arrival" -- start
echo "   ✅ Application started"
echo ""

# Save PM2 configuration
echo "7. Saving PM2 configuration..."
pm2 save
echo "   ✅ PM2 config saved"
echo ""

# Wait a moment for app to start
echo "8. Waiting for application to start..."
sleep 3
echo ""

# Test the site
echo "9. Testing site..."
echo ""
echo "   Testing localhost:3003..."
curl -s -o /dev/null -w "   HTTP Status: %{http_code}\n" http://localhost:3003
echo ""
echo "   Testing arrival.ssda.so..."
curl -s -o /dev/null -w "   HTTP Status: %{http_code}\n" http://arrival.ssda.so
echo ""

# Show PM2 status
echo "10. Current PM2 status:"
pm2 status
echo ""

echo "✅ ============================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "✅ ============================================="
echo ""
echo "Your site should now be accessible at:"
echo "   http://arrival.ssda.so"
echo ""
echo "Next steps:"
echo "1. Test the site in your browser"
echo "2. Add HTTPS: sudo certbot --apache -d arrival.ssda.so"
echo "3. Change default passwords"
echo ""
echo "Useful commands:"
echo "  pm2 status                        - Check app status"
echo "  pm2 logs immigration-arrival      - View logs"
echo "  pm2 restart immigration-arrival   - Restart app"
echo ""
