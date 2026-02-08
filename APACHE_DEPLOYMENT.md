# 🚀 Deployment with Apache (Already Running)

## ✅ Your Server Uses Apache

Since Apache is already running on your server, we'll use it instead of Nginx!

---

## 📋 Quick Deployment Steps

### Step 1: Create Deployment Directory

```bash
sudo mkdir -p /var/www/arrival.ssda.so
sudo chown $USER:$USER /var/www/arrival.ssda.so
```

---

### Step 2: Upload Files

**Option A: Using rsync (if you have SSH access from local machine)**
```bash
# From your LOCAL machine
rsync -avz --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  /var/www/allprojects/immigration-schedule/ \
  user@arrival.ssda.so:/var/www/arrival.ssda.so/
```

**Option B: Copy files directly on server**
```bash
# If you're already on the server
sudo cp -r /var/www/allprojects/immigration-schedule /var/www/arrival.ssda.so
sudo chown -R $USER:$USER /var/www/arrival.ssda.so
```

---

### Step 3: Install Dependencies

```bash
cd /var/www/arrival.ssda.so

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create database
npx prisma db push

# Build application
npm run build
```

---

### Step 4: Configure Apache

Create Apache virtual host configuration:

```bash
sudo nano /etc/apache2/sites-available/arrival.ssda.so.conf
```

**Paste this configuration:**
```apache
<VirtualHost *:80>
    ServerName arrival.ssda.so
    ServerAlias www.arrival.ssda.so
    
    # Redirect to HTTPS
    Redirect permanent / https://arrival.ssda.so/
</VirtualHost>

<VirtualHost *:443>
    ServerName arrival.ssda.so
    ServerAlias www.arrival.ssda.so
    
    # Enable SSL
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/arrival.ssda.so/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/arrival.ssda.so/privkey.pem
    
    # Proxy settings
    ProxyPreserveHost On
    ProxyPass / http://localhost:3003/
    ProxyPassReverse / http://localhost:3003/
    
    # WebSocket support
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://localhost:3003/$1" [P,L]
    
    # Logs
    ErrorLog ${APACHE_LOG_DIR}/arrival.ssda.so-error.log
    CustomLog ${APACHE_LOG_DIR}/arrival.ssda.so-access.log combined
</VirtualHost>
```

---

### Step 5: Enable Required Apache Modules

```bash
# Enable proxy modules
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo a2enmod ssl
```

---

### Step 6: Get SSL Certificate

```bash
# Install certbot for Apache
sudo apt install certbot python3-certbot-apache

# Get SSL certificate
sudo certbot --apache -d arrival.ssda.so -d www.arrival.ssda.so

# Certbot will automatically update Apache config
```

---

### Step 7: Enable Site

```bash
# Enable the site
sudo a2ensite arrival.ssda.so.conf

# Test Apache configuration
sudo apachectl configtest

# Reload Apache
sudo systemctl reload apache2
```

---

### Step 8: Start Application with PM2

```bash
cd /var/www/arrival.ssda.so

# Install PM2 if not installed
sudo npm install -g pm2

# Start app
PORT=3003 pm2 start npm --name "immigration-schedule" -- start

# Save PM2 config
pm2 save

# Setup auto-start
pm2 startup
# Follow the command it gives you

# Check status
pm2 status
pm2 logs immigration-schedule
```

---

### Step 9: Configure Firewall

```bash
# Apache should already have firewall rules
# Verify
sudo ufw status

# If needed:
sudo ufw allow 'Apache Full'
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

### Step 10: Test!

```bash
# Check if app is running
curl http://localhost:3003

# Check Apache
sudo systemctl status apache2

# Check PM2
pm2 status

# Test the site
curl -I https://arrival.ssda.so
```

Then open in browser: **https://arrival.ssda.so**

---

## 🔧 If SSL Certificate Doesn't Exist Yet

### Manual Apache SSL Configuration (if certbot fails)

Edit the Apache config:
```bash
sudo nano /etc/apache2/sites-available/arrival.ssda.so.conf
```

**For now, disable HTTPS (test HTTP first):**
```apache
<VirtualHost *:80>
    ServerName arrival.ssda.so
    ServerAlias www.arrival.ssda.so
    
    # Proxy settings
    ProxyPreserveHost On
    ProxyPass / http://localhost:3003/
    ProxyPassReverse / http://localhost:3003/
    
    # Logs
    ErrorLog ${APACHE_LOG_DIR}/arrival.ssda.so-error.log
    CustomLog ${APACHE_LOG_DIR}/arrival.ssda.so-access.log combined
</VirtualHost>
```

Then:
```bash
sudo a2ensite arrival.ssda.so.conf
sudo systemctl reload apache2
```

Test: **http://arrival.ssda.so** (without https)

Once working, run:
```bash
sudo certbot --apache -d arrival.ssda.so
```

---

## 🚨 Quick Troubleshooting

### Issue: Directory doesn't exist

```bash
# Create it
sudo mkdir -p /var/www/arrival.ssda.so
sudo chown $USER:$USER /var/www/arrival.ssda.so

# Copy files from your working directory
cp -r /var/www/allprojects/immigration-schedule/* /var/www/arrival.ssda.so/
```

---

### Issue: Apache won't reload

```bash
# Check config
sudo apachectl configtest

# Check error logs
sudo tail -50 /var/log/apache2/error.log

# Restart Apache
sudo systemctl restart apache2
```

---

### Issue: Port 3003 not accessible

```bash
# Check if Next.js is running
curl http://localhost:3003

# If not, start it
cd /var/www/arrival.ssda.so
PORT=3003 pm2 start npm --name "immigration-schedule" -- start
```

---

### Issue: SSL certificate error

```bash
# Run certbot again
sudo certbot --apache -d arrival.ssda.so -d www.arrival.ssda.so

# Or test without HTTPS first
# Use the HTTP-only config above
```

---

## ⚡ Quick Deploy (All-in-One)

Run these commands one by one:

```bash
# 1. Create directory
sudo mkdir -p /var/www/arrival.ssda.so
sudo chown $USER:$USER /var/www/arrival.ssda.so

# 2. Copy files
cp -r /var/www/allprojects/immigration-schedule/* /var/www/arrival.ssda.so/

# 3. Setup application
cd /var/www/arrival.ssda.so
npm install
npx prisma generate
npx prisma db push
npm run build

# 4. Create Apache config (HTTP only for now)
sudo tee /etc/apache2/sites-available/arrival.ssda.so.conf << 'EOF'
<VirtualHost *:80>
    ServerName arrival.ssda.so
    ServerAlias www.arrival.ssda.so
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:3003/
    ProxyPassReverse / http://localhost:3003/
    
    ErrorLog ${APACHE_LOG_DIR}/arrival.ssda.so-error.log
    CustomLog ${APACHE_LOG_DIR}/arrival.ssda.so-access.log combined
</VirtualHost>
EOF

# 5. Enable modules and site
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2ensite arrival.ssda.so.conf

# 6. Test and reload Apache
sudo apachectl configtest
sudo systemctl reload apache2

# 7. Start application
PORT=3003 pm2 start npm --name "immigration-schedule" -- start
pm2 save

# 8. Test
curl -I http://arrival.ssda.so
```

**Then visit:** http://arrival.ssda.so

**Once working, add HTTPS:**
```bash
sudo certbot --apache -d arrival.ssda.so -d www.arrival.ssda.so
```

---

## ✅ Verification Steps

After deployment, check:

1. **App running:**
   ```bash
   pm2 status
   curl http://localhost:3003
   ```

2. **Apache running:**
   ```bash
   sudo systemctl status apache2
   ```

3. **Site accessible:**
   ```bash
   curl -I http://arrival.ssda.so
   ```

4. **Open in browser:**
   ```
   http://arrival.ssda.so
   ```

---

## 📞 Still Not Working?

Run this diagnostic:

```bash
# Check everything
echo "=== PM2 Status ==="
pm2 status

echo ""
echo "=== Apache Status ==="
sudo systemctl status apache2

echo ""
echo "=== Port 3003 ==="
curl -I http://localhost:3003

echo ""
echo "=== Apache Config Test ==="
sudo apachectl configtest

echo ""
echo "=== Apache Sites Enabled ==="
ls -la /etc/nginx/sites-enabled/ | grep arrival

echo ""
echo "=== Recent Apache Errors ==="
sudo tail -20 /var/log/apache2/error.log
```

Send me the output and I'll help fix it!

---

**Next:** Once you run these commands, let me know what happens!
