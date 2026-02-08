# 🔧 Final Fix for arrival.ssda.so

## Problem Identified

Your files were moved from `/var/www/immigration-schedule` to `/var/www/allprojects/immigration-schedule`

The subdomain needs to point to the correct location.

---

## ✅ Quick Fix (Run These Commands)

Copy and paste these commands one by one:

### Step 1: Stop old process
```bash
pm2 delete immigration-arrival
```

### Step 2: Update Apache config
```bash
sudo nano /etc/apache2/sites-available/arrival.ssda.so.conf
```

**Replace ALL content with:**
```apache
<VirtualHost *:80>
    ServerName arrival.ssda.so
    ServerAlias www.arrival.ssda.so
    
    # Proxy settings
    ProxyPreserveHost On
    ProxyPass /uploads !
    ProxyPass / http://localhost:3003/
    ProxyPassReverse / http://localhost:3003/
    
    # Serve uploaded files directly from allprojects directory
    Alias /uploads /var/www/allprojects/immigration-schedule/public/uploads
    
    <Directory /var/www/allprojects/immigration-schedule/public/uploads>
        Options FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>
    
    # Logs
    ErrorLog ${APACHE_LOG_DIR}/arrival.ssda.so-error.log
    CustomLog ${APACHE_LOG_DIR}/arrival.ssda.so-access.log combined
</VirtualHost>
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

### Step 3: Test and reload Apache
```bash
sudo apachectl configtest
sudo systemctl reload apache2
```

### Step 4: Create .env in correct directory
```bash
cat > /var/www/allprojects/immigration-schedule/.env << 'EOF'
DATABASE_URL="file:/var/lib/immigration-schedule/prod.db"
NODE_ENV=production
EOF
```

### Step 5: Rebuild application
```bash
cd /var/www/allprojects/immigration-schedule
rm -rf .next
npm run build
```

### Step 6: Start application
```bash
cd /var/www/allprojects/immigration-schedule
PORT=3003 pm2 start npm --name "immigration-arrival" -- start
pm2 save
```

### Step 7: Test
```bash
# Wait a moment
sleep 5

# Test localhost
curl -I http://localhost:3003

# Test domain
curl -I http://arrival.ssda.so
```

### Step 8: Open in browser
```
http://arrival.ssda.so
```

You should see the login page with 🛫 logo!

---

## 🎯 Expected Results

After running these commands:

✅ Apache points to `/var/www/allprojects/immigration-schedule`  
✅ Application runs from correct directory  
✅ Database connects properly  
✅ Site loads at http://arrival.ssda.so  
✅ Logo shows 🛫 (airplane emoji)  
✅ All features work  

---

## 📁 Directory Structure

```
/var/www/allprojects/immigration-schedule/
├── app/
├── lib/
├── prisma/
├── public/
│   └── uploads/
│       └── receipts/
├── .env (created in step 4)
├── .next/ (created in step 5)
└── node_modules/
```

---

## 🔐 After It Works

### Add HTTPS
```bash
sudo certbot --apache -d arrival.ssda.so -d www.arrival.ssda.so
```

### Check Status
```bash
pm2 status
pm2 logs immigration-arrival
sudo systemctl status apache2
```

---

## 🆘 If Still Not Working

### Check Each Component

**1. Check if app is running:**
```bash
pm2 list
curl http://localhost:3003
```

**2. Check Apache:**
```bash
sudo systemctl status apache2
sudo apachectl configtest
```

**3. Check Apache error logs:**
```bash
sudo tail -50 /var/log/apache2/arrival.ssda.so-error.log
sudo tail -50 /var/log/apache2/error.log
```

**4. Check if port 3003 is listening:**
```bash
sudo lsof -i :3003
```

**5. Check PM2 logs:**
```bash
pm2 logs immigration-arrival --lines 50
```

---

## 📞 Quick Diagnostic Command

Run this to see everything:

```bash
echo "=== PM2 Status ==="
pm2 list

echo ""
echo "=== Port 3003 ==="
curl -I http://localhost:3003 2>&1 | head -5

echo ""
echo "=== Apache Config ==="
sudo apachectl configtest

echo ""
echo "=== Site Test ==="
curl -I http://arrival.ssda.so 2>&1 | head -10

echo ""
echo "=== Directory ==="
ls -la /var/www/allprojects/immigration-schedule | head -10
```

---

## ✅ Final Checklist

- [ ] Apache config updated to point to `/var/www/allprojects/immigration-schedule`
- [ ] Apache reloaded successfully
- [ ] .env file created in correct directory
- [ ] Application rebuilt in correct directory
- [ ] PM2 started from correct directory
- [ ] PM2 config saved
- [ ] App responds on localhost:3003
- [ ] Apache proxies correctly
- [ ] Site loads at http://arrival.ssda.so
- [ ] Login page shows 🛫 logo
- [ ] Can login and access dashboards

---

**Run the commands above, then check:** http://arrival.ssda.so

🎯 **The site will work once these steps are complete!**
