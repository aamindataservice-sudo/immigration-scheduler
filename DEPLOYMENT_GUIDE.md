# 🚀 Deployment Guide - arrival.ssda.so

## 📋 Pre-Deployment Checklist

### 1. Create App Icons

You'll need to create these icon files and place them in `/public/`:

**Required Icons:**
- `icon-192.png` (192x192 pixels) - Somalia flag or immigration icon
- `icon-512.png` (512x512 pixels) - Somalia flag or immigration icon
- `favicon.ico` (32x32 pixels) - Browser tab icon

**Suggested Design:**
- Somalia flag colors (blue background, white star)
- Or airplane icon 🛫
- Or passport icon 📘
- Or Somalia map outline

**How to create:**
```bash
# Option 1: Use online tools
- https://realfavicongenerator.net/
- Upload your logo
- Generate all sizes

# Option 2: Use imagemagick
convert logo.png -resize 192x192 icon-192.png
convert logo.png -resize 512x512 icon-512.png
convert logo.png -resize 32x32 favicon.ico
```

---

## 🌐 Deployment Steps

### Step 1: Prepare Server

```bash
# SSH into arrival.ssda.so
ssh user@arrival.ssda.so

# Create directory
sudo mkdir -p /var/www/arrival.ssda.so
sudo chown $USER:$USER /var/www/arrival.ssda.so

# Create uploads directory
sudo mkdir -p /var/lib/immigration-schedule
sudo chown $USER:$USER /var/lib/immigration-schedule
```

---

### Step 2: Upload Files

**Option A: Using rsync (Recommended)**
```bash
# From your local machine
rsync -avz --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  /var/www/allprojects/immigration-schedule/ \
  user@arrival.ssda.so:/var/www/arrival.ssda.so/
```

**Option B: Using git**
```bash
# On local machine
cd /var/www/allprojects/immigration-schedule
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push origin main

# On server
cd /var/www/arrival.ssda.so
git clone your-repo-url .
```

**Option C: Using scp**
```bash
# Create tar archive
cd /var/www/allprojects
tar -czf immigration-schedule.tar.gz immigration-schedule/

# Upload
scp immigration-schedule.tar.gz user@arrival.ssda.so:/tmp/

# On server
cd /var/www/arrival.ssda.so
tar -xzf /tmp/immigration-schedule.tar.gz --strip-components=1
```

---

### Step 3: Install Dependencies

```bash
# On server (arrival.ssda.so)
cd /var/www/arrival.ssda.so

# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
npm install

# Install PM2 (process manager)
sudo npm install -g pm2
```

---

### Step 4: Configure Environment

```bash
# Create .env file
cat > /var/www/arrival.ssda.so/.env << 'EOF'
DATABASE_URL="file:/var/lib/immigration-schedule/prod.db"
NODE_ENV=production
EOF

# Set permissions
chmod 600 /var/www/arrival.ssda.so/.env
```

---

### Step 5: Setup Database

```bash
# Generate Prisma client
cd /var/www/arrival.ssda.so
npx prisma generate

# Create/migrate database
npx prisma db push

# Verify database exists
ls -la /var/lib/immigration-schedule/
```

---

### Step 6: Build Application

```bash
cd /var/www/arrival.ssda.so
npm run build
```

---

### Step 7: Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/arrival.ssda.so
```

**Paste this configuration:**
```nginx
server {
    listen 80;
    server_name arrival.ssda.so www.arrival.ssda.so;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name arrival.ssda.so www.arrival.ssda.so;
    
    # SSL certificates (configure with Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/arrival.ssda.so/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/arrival.ssda.so/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    # Logs
    access_log /var/log/nginx/arrival.ssda.so-access.log;
    error_log /var/log/nginx/arrival.ssda.so-error.log;
    
    # Max upload size
    client_max_body_size 50M;
    
    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Static files
    location /_next/static {
        proxy_pass http://localhost:3003/_next/static;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    
    # Uploaded files
    location /uploads {
        alias /var/www/arrival.ssda.so/public/uploads;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/arrival.ssda.so /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### Step 8: Setup SSL Certificate

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d arrival.ssda.so -d www.arrival.ssda.so

# Auto-renewal
sudo certbot renew --dry-run
```

---

### Step 9: Start Application with PM2

```bash
cd /var/www/arrival.ssda.so

# Start with PM2
PORT=3003 pm2 start npm --name "immigration-schedule" -- start

# Save PM2 config
pm2 save

# Setup auto-start on reboot
pm2 startup
# Follow the instructions printed

# Check status
pm2 status
pm2 logs immigration-schedule
```

---

### Step 10: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

---

## 🎨 Logo/Icon Updates

### Update App Icon in All Pages

**Files to Update:**

1. **`/app/layout.tsx`** - Main layout
2. **`/app/page.tsx`** - Login page
3. **`/app/admin/page.tsx`** - Admin dashboard
4. **`/app/officer/page.tsx`** - Officer dashboard
5. **`/app/checker/page.tsx`** - Checker dashboard
6. **`/app/super-admin/page.tsx`** - Super admin dashboard

**Current Emoji:** 🛫 (airplane)

**Change To:**
- 🇸🇴 (Somalia flag emoji)
- 📘 (Passport/document)
- 🏛️ (Government building)
- Or upload custom icon

**Example Change in Each File:**

**Before:**
```tsx
<div className="auth-logo">🛫</div>
```

**After (Option 1 - Somalia Flag):**
```tsx
<div className="auth-logo">🇸🇴</div>
```

**After (Option 2 - Passport):**
```tsx
<div className="auth-logo">📘</div>
```

**After (Option 3 - Custom Image):**
```tsx
<img src="/logo.png" alt="Immigration" className="auth-logo" />
```

---

## 📝 Environment Configuration

### Production Environment Variables

Create `/var/www/arrival.ssda.so/.env.production`:

```env
# Database
DATABASE_URL="file:/var/lib/immigration-schedule/prod.db"

# Node Environment
NODE_ENV=production

# App Settings
PORT=3003
NEXT_PUBLIC_APP_URL=https://arrival.ssda.so

# Optional: API Keys
# NEXT_PUBLIC_API_KEY=your-key-here
```

---

## 🔒 Security Hardening

### 1. Set Proper Permissions

```bash
cd /var/www/arrival.ssda.so

# Application files
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;

# Node modules
chmod -R 755 node_modules

# Database
chmod 600 /var/lib/immigration-schedule/prod.db

# Uploads directory
chmod 755 public/uploads
chmod 755 public/uploads/receipts
```

### 2. Secure Sensitive Files

```bash
# Protect .env
chmod 600 .env .env.production

# Protect database
sudo chown www-data:www-data /var/lib/immigration-schedule/prod.db
```

### 3. Configure Rate Limiting

Add to Nginx config:
```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=20r/m;

location /api/auth/login {
    limit_req zone=login burst=3 nodelay;
    proxy_pass http://localhost:3003;
}

location /api/ {
    limit_req zone=api burst=10 nodelay;
    proxy_pass http://localhost:3003;
}
```

---

## 📊 Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs immigration-schedule

# Check memory/CPU
pm2 list
```

### Log Files

```bash
# Application logs
pm2 logs immigration-schedule

# Nginx access logs
sudo tail -f /var/log/nginx/arrival.ssda.so-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/arrival.ssda.so-error.log
```

---

## 🔄 Updating the Application

### When You Make Changes

```bash
# On local machine
cd /var/www/allprojects/immigration-schedule
rsync -avz --exclude 'node_modules' \
  --exclude '.next' \
  . user@arrival.ssda.so:/var/www/arrival.ssda.so/

# On server
cd /var/www/arrival.ssda.so
npm install  # If dependencies changed
npm run build
pm2 restart immigration-schedule
```

---

## 🎨 Logo Change Instructions

### Option 1: Use Somalia Flag Emoji

**Update these files:**

1. `/app/layout.tsx` (line ~28):
```tsx
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🇸🇴</text></svg>" />
```

2. `/app/page.tsx` (search for `🛫`):
```tsx
// Change all instances of 🛫 to 🇸🇴
<div className="auth-logo">🇸🇴</div>
```

3. Same for all other pages:
- `/app/admin/page.tsx`
- `/app/officer/page.tsx`
- `/app/checker/page.tsx`
- `/app/super-admin/page.tsx`
- `/app/change-password/page.tsx`

---

### Option 2: Upload Custom Logo

**Step 1: Create PNG files**
```bash
# Place your logo files in public/
cp your-logo-192.png /var/www/allprojects/immigration-schedule/public/icon-192.png
cp your-logo-512.png /var/www/allprojects/immigration-schedule/public/icon-512.png
cp your-logo-32.png /var/www/allprojects/immigration-schedule/public/favicon.ico
```

**Step 2: Update manifest.json** (already configured)

**Step 3: Update layout.tsx**
```tsx
<link rel="apple-touch-icon" href="/icon-192.png" />
<link rel="icon" href="/favicon.ico" />
```

**Step 4: Use in pages**
```tsx
<img src="/icon-192.png" alt="Immigration" style={{ width: "64px", height: "64px" }} />
```

---

### Option 3: Use Custom SVG

**Create `/public/logo.svg`:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!-- Somalia flag -->
  <rect width="100" height="100" fill="#4189DD"/>
  <path d="M50 20 L61 48 L91 48 L67 65 L77 93 L50 76 L23 93 L33 65 L9 48 L39 48 Z" fill="white"/>
</svg>
```

**Use it:**
```tsx
<img src="/logo.svg" alt="Immigration" className="auth-logo" />
```

---

## 🔧 DNS Configuration

### Point Domain to Server

**At your DNS provider (e.g., CloudFlare, Namecheap):**

```
Type: A
Name: arrival
Value: [Your Server IP]
TTL: Auto

Type: A  
Name: www.arrival
Value: [Your Server IP]
TTL: Auto
```

**Verify DNS:**
```bash
nslookup arrival.ssda.so
ping arrival.ssda.so
```

---

## ✅ Post-Deployment Verification

### 1. Test Access

```bash
# Test HTTP (should redirect to HTTPS)
curl -I http://arrival.ssda.so

# Test HTTPS
curl -I https://arrival.ssda.so

# Test specific pages
curl -I https://arrival.ssda.so/checker
curl -I https://arrival.ssda.so/admin
```

### 2. Test Functionality

**Login Test:**
```
1. Go to https://arrival.ssda.so
2. Login with test credentials
3. Verify dashboard loads
```

**Payment Check Test:**
```
1. Login as checker
2. Check a payment receipt
3. Verify download works
4. Check logs in super-admin
```

**E-Visa Test:**
```
1. Go to e-Visa tab
2. Enter test data
3. Verify check works
4. Try download if found
```

### 3. Check Logs

```bash
# PM2 logs
pm2 logs immigration-schedule --lines 50

# Nginx logs
sudo tail -50 /var/log/nginx/arrival.ssda.so-error.log
```

---

## 🔄 Maintenance

### Backup Database

```bash
# Create backup script
cat > /var/www/arrival.ssda.so/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/backups/immigration-schedule
mkdir -p $BACKUP_DIR
cp /var/lib/immigration-schedule/prod.db $BACKUP_DIR/prod_$DATE.db
# Keep only last 30 days
find $BACKUP_DIR -name "prod_*.db" -mtime +30 -delete
EOF

chmod +x /var/www/arrival.ssda.so/backup.sh

# Add to cron (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /var/www/arrival.ssda.so/backup.sh
```

### Clean Old Receipts

```bash
# Create cleanup script
cat > /var/www/arrival.ssda.so/cleanup-receipts.sh << 'EOF'
#!/bin/bash
# Delete receipts older than 30 days
find /var/www/arrival.ssda.so/public/uploads/receipts -name "receipt_*.html" -mtime +30 -delete
EOF

chmod +x /var/www/arrival.ssda.so/cleanup-receipts.sh

# Add to cron (weekly)
# 0 3 * * 0 /var/www/arrival.ssda.so/cleanup-receipts.sh
```

---

## 🚨 Troubleshooting

### App Won't Start

```bash
# Check PM2 logs
pm2 logs immigration-schedule

# Check if port is in use
sudo lsof -i :3003

# Restart app
pm2 restart immigration-schedule
```

### Database Locked

```bash
# Check permissions
ls -la /var/lib/immigration-schedule/prod.db

# Fix ownership
sudo chown www-data:www-data /var/lib/immigration-schedule/prod.db
```

### Nginx Error

```bash
# Test config
sudo nginx -t

# Check error logs
sudo tail -50 /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Check certificate
sudo certbot certificates
```

---

## 📱 Update App Name & Title

### Update `/app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  title: "Somalia Immigration System",
  description: "Official Somalia Immigration Arrival Management System",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
  // ... rest of config
};
```

### Update `/public/manifest.json`:

```json
{
  "name": "Somalia Immigration Arrival System",
  "short_name": "Immigration",
  "description": "Official Somalia Immigration Management",
  // ... rest of config
}
```

---

## 🎯 Quick Deployment Checklist

- [ ] Create/upload logo files (icon-192.png, icon-512.png, favicon.ico)
- [ ] Update logo emoji in all page files
- [ ] Configure DNS (A records)
- [ ] SSH into arrival.ssda.so
- [ ] Create directory structure
- [ ] Upload application files
- [ ] Install Node.js and dependencies
- [ ] Configure environment variables
- [ ] Generate Prisma client
- [ ] Create/migrate database
- [ ] Build application
- [ ] Configure Nginx
- [ ] Setup SSL certificate
- [ ] Start with PM2
- [ ] Configure firewall
- [ ] Test access (HTTP/HTTPS)
- [ ] Test login
- [ ] Test payment checking
- [ ] Test e-visa checking
- [ ] Setup backups (cron jobs)
- [ ] Setup monitoring
- [ ] Document admin credentials

---

## 📞 Support & Resources

### Useful Commands

```bash
# Check app status
pm2 status

# Restart app
pm2 restart immigration-schedule

# View logs
pm2 logs immigration-schedule --lines 100

# Check Nginx
sudo systemctl status nginx

# Reload Nginx
sudo systemctl reload nginx

# Check SSL
sudo certbot certificates

# Renew SSL
sudo certbot renew
```

### Files to Keep Safe

1. `/var/lib/immigration-schedule/prod.db` - Database
2. `/var/www/arrival.ssda.so/.env` - Environment config
3. `/etc/nginx/sites-available/arrival.ssda.so` - Nginx config
4. PM2 startup script
5. SSL certificates

---

## 🎉 Deployment Complete

After following these steps, your immigration system will be:

✅ Running on https://arrival.ssda.so  
✅ Using custom Somalia logo  
✅ Secured with SSL  
✅ Auto-restarting on server reboot  
✅ Backed up daily  
✅ Monitored with PM2  
✅ Production-ready!  

**Next:** Test thoroughly and train your users!

---

**Guide Version:** 1.0  
**Last Updated:** January 25, 2026  
**For:** arrival.ssda.so deployment
