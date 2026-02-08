# Quick Start Guide - Super Admin & Checker System

## 🚀 5-Minute Setup

### Step 1: Create Super Admin (1 min)
```bash
cd /var/www/immigration-schedule
node scripts/create-super-admin.js
```

Follow the prompts:
- Full Name: `Super Administrator`
- Phone: `252900000000`
- Password: (press Enter for default `superadmin123`)

### Step 2: Start Application (30 sec)
```bash
npm run dev
# Or if already running, just refresh your browser
```

### Step 3: Log In as Super Admin (30 sec)
1. Open: `http://localhost:3000`
2. Enter phone: `252900000000`
3. Enter password: `superadmin123`
4. Click "Sign In"
5. You'll see the Super Admin dashboard

### Step 4: Create a Checker User (1 min)
1. Click "Users & Checkers" tab
2. Click "➕ Create Checker"
3. Fill in:
   - Name: `Payment Checker`
   - Phone: `252900000001`
   - Password: (leave empty for `checker123`)
4. Click "Create Checker"

### Step 5: Test Payment Checking (2 min)
1. Click logout
2. Log in as checker:
   - Phone: `252900000001`
   - Password: `checker123`
3. Try checking a payment:
   - Click "💳 Payment Receipt" tab
   - Enter serial: `1763816489`
   - Click "🔍 Check Payment"
4. View your check history below

## 📋 Quick Reference

### User Roles
| Role | Route | Can Do |
|------|-------|--------|
| SUPER_ADMIN | `/super-admin` | Everything + create checkers + view all checks |
| ADMIN | `/admin` | Manage shifts & users |
| CHECKER | `/checker` | Check payments & e-visas |
| OFFICER | `/officer` | View & choose shifts |

### Default Passwords
- Super Admin: `superadmin123` (or what you set)
- Admin: `admin123`
- Checker: `checker123`
- Officer: `officer123`

### API Endpoints

**Check Payment Receipt**
```javascript
POST /api/payment/check-receipt
{
  "serialNumber": "1763816489",
  "checkedBy": "user_id"
}
```

**Check E-Visa**
```javascript
POST /api/payment/check-evisa
{
  "passportNumber": "NXBRJ51J6",
  "referenceNumber": "1764136564",
  "visaYear": "2026",
  "visaMonth": "Jan",
  "checkedBy": "user_id"
}
```

**Get My Checks**
```javascript
GET /api/payment/my-checks?userId=user_id&limit=50
```

**Get All Checks (Super Admin Only)**
```javascript
GET /api/payment/history?userId=super_admin_id&limit=100
```

## 🎯 Common Tasks

### Create Multiple Checkers
1. Log in as Super Admin
2. Go to "Users & Checkers"
3. Click "➕ Create Checker" for each user
4. Share credentials with checker users

### View All Payment Checks
1. Log in as Super Admin
2. Click "📊 Payment Checks" tab
3. See complete history from all checkers

### Deactivate a Checker
1. Log in as Super Admin
2. Go to "Users & Checkers"
3. Find the checker
4. Click "Deactivate" button

## 🔧 Troubleshooting

### Issue: Can't create super admin
**Solution**: Make sure you're in the correct directory
```bash
cd /var/www/immigration-schedule
node scripts/create-super-admin.js
```

### Issue: User already exists
**Solution**: The script will ask if you want to upgrade existing user to SUPER_ADMIN

### Issue: Payment check returns ERROR
**Possible causes**:
- External URL is down
- Network/firewall blocking
- Invalid serial/passport number

### Issue: Can't see "Create Checker" button
**Solution**: Make sure you're logged in as SUPER_ADMIN, not ADMIN

### Issue: Build errors
**Solution**: Regenerate Prisma client
```bash
npx prisma generate
npm run build
```

## 📱 Mobile Responsive

All dashboards are mobile-friendly:
- Checker dashboard works great on phones
- Super admin dashboard adapts to smaller screens
- Forms are touch-friendly

## 🔐 Security Best Practices

1. **Change default passwords** after first login
2. **Deactivate unused checkers** immediately
3. **Review audit logs** regularly in Payment Checks tab
4. **Use strong passwords** for super admin accounts
5. **Don't share checker credentials** between users

## 💾 Database Backup

Before making changes, backup your database:
```bash
cp /var/lib/immigration-schedule/prod.db /var/lib/immigration-schedule/prod.db.backup
```

## 📞 Support

For issues:
1. Check `SUPER_ADMIN_SETUP.md` for detailed docs
2. Check `IMPLEMENTATION_SUMMARY.md` for technical details
3. Review inline code comments
4. Check browser console for errors

## ⚡ Performance Tips

- Payment checks are fast (HEAD requests only)
- History loads last 50/100 checks (configurable)
- All checks are indexed for fast retrieval
- UI updates in real-time with toast notifications

## 🎉 You're Ready!

That's it! You now have:
- ✅ Super Admin account
- ✅ Checker user
- ✅ Payment verification system
- ✅ Complete audit trail

Start checking payments and managing your team!

---

**Need more help?** See `SUPER_ADMIN_SETUP.md` for complete documentation.
