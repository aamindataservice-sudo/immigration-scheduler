# 🚀 Quick Deployment to arrival.ssda.so

## ⚡ 5-Minute Deployment

### Step 1: Change Logo (Optional)
```bash
cd /var/www/allprojects/immigration-schedule
./scripts/change-logo.sh
```
Choose: 1 for 🇸🇴 Somalia flag

---

### Step 2: Deploy to Server
```bash
# Edit deployment script with your server details
nano scripts/deploy-to-production.sh
# Change SERVER_USER to your username

# Run deployment
./scripts/deploy-to-production.sh
```

Enter "yes" when prompted

---

### Step 3: Configure Domain (If Not Done)

**At your DNS provider:**
```
A Record: arrival.ssda.so → [Your Server IP]
A Record: www.arrival.ssda.so → [Your Server IP]
```

Wait 5-10 minutes for DNS propagation

---

### Step 4: Setup SSL

```bash
# SSH to server
ssh user@arrival.ssda.so

# Install certbot (if not installed)
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d arrival.ssda.so -d www.arrival.ssda.so
```

---

### Step 5: Test!

```
https://arrival.ssda.so
```

Login with your credentials and test!

---

## 🎨 Logo Options

### Quick Logo Change

**Option 1: Somalia Flag** 🇸🇴
```bash
./scripts/change-logo.sh
# Choose 1
```

**Option 2: Passport** 📘
```bash
./scripts/change-logo.sh
# Choose 2
```

**Option 3: Government Building** 🏛️
```bash
./scripts/change-logo.sh
# Choose 3
```

---

## 🔧 If You Have Custom Logo

1. Create PNG files:
   - `icon-192.png` (192x192)
   - `icon-512.png` (512x512)
   - `favicon.ico` (32x32)

2. Place in `/public/` directory

3. They'll be automatically used

---

## 📊 After Deployment

### Check Status
```bash
ssh user@arrival.ssda.so
pm2 status
pm2 logs immigration-schedule
```

### Update Later
```bash
# Just run deployment script again
./scripts/deploy-to-production.sh
```

### Backup Database
```bash
ssh user@arrival.ssda.so
cp /var/lib/immigration-schedule/prod.db ~/backup-$(date +%Y%m%d).db
```

---

## ✅ Deployment Checklist

- [ ] Logo changed (if desired)
- [ ] Deployment script configured
- [ ] DNS pointing to server
- [ ] Files uploaded
- [ ] Dependencies installed
- [ ] Database created
- [ ] App built
- [ ] Nginx configured
- [ ] SSL certificate installed
- [ ] PM2 running app
- [ ] Firewall configured
- [ ] Site accessible via HTTPS
- [ ] Login tested
- [ ] Payment checking tested
- [ ] E-Visa checking tested
- [ ] Super admin panel tested

---

## 🆘 Quick Troubleshooting

**Site not accessible:**
```bash
# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check PM2
pm2 status
pm2 logs immigration-schedule
```

**Database errors:**
```bash
# Check database file
ls -la /var/lib/immigration-schedule/prod.db

# Regenerate
cd /var/www/arrival.ssda.so
npx prisma db push
```

**Build errors:**
```bash
# Clear and rebuild
rm -rf .next
npm run build
```

---

## 📞 Need Help?

**Documentation:**
- `DEPLOYMENT_GUIDE.md` - Complete guide
- `FINAL_CHECKER_SYSTEM.md` - System overview
- `LOGIN_CREDENTIALS.md` - User accounts

**Commands:**
```bash
# View all docs
ls -la *.md

# Search docs
grep -r "your-search-term" *.md
```

---

**Ready to deploy? Run:**
```bash
./scripts/deploy-to-production.sh
```

🎉 **Good luck!**
