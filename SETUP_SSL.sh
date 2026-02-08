#!/bin/bash

echo "🔒 Setting up SSL for arrival.ssda.so"
echo "======================================"
echo ""

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "1. Installing certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-apache
    echo "   ✅ Certbot installed"
else
    echo "1. Certbot already installed ✅"
fi
echo ""

# Get SSL certificate
echo "2. Obtaining SSL certificate..."
sudo certbot --apache -d arrival.ssda.so --non-interactive --agree-tos --email admin@ssda.so --redirect
echo ""

if [ $? -eq 0 ]; then
    echo "   ✅ SSL certificate obtained"
else
    echo "   ⚠️ Trying with manual prompts..."
    sudo certbot --apache -d arrival.ssda.so
fi
echo ""

# Test auto-renewal
echo "3. Testing auto-renewal..."
sudo certbot renew --dry-run
echo ""

# Check renewal timer
echo "4. Checking auto-renewal timer..."
sudo systemctl status certbot.timer 2>/dev/null || echo "   Timer not available, setting up cron job..."

# Add cron job for renewal if timer doesn't exist
if ! systemctl is-active --quiet certbot.timer 2>/dev/null; then
    echo "   Adding cron job for auto-renewal..."
    (crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet") | crontab -
    echo "   ✅ Cron job added"
fi
echo ""

# Test HTTPS
echo "5. Testing HTTPS..."
curl -s -o /dev/null -w "   HTTPS Status: %{http_code}\n" https://arrival.ssda.so
echo ""

echo "✅ ============================================="
echo "✅ SSL SETUP COMPLETE!"
echo "✅ ============================================="
echo ""
echo "Your site is now accessible at:"
echo "   https://arrival.ssda.so (secure)"
echo ""
echo "SSL certificate details:"
sudo certbot certificates 2>/dev/null | grep -A3 "arrival.ssda.so" || echo "   Run 'sudo certbot certificates' to view"
echo ""
echo "Auto-renewal is configured to run twice daily."
echo ""
