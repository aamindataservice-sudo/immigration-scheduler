# 🧪 Test Data for Payment Checking

## Payment Receipt Testing

### Test Serial Number
```
Serial: 763816489
URL: https://etas.gov.so/receipt/763816489
```

**How to Test:**
1. Log in as Checker
2. Click "💳 Payment Receipt" tab
3. Enter: `763816489`
4. Click "🔍 Check Payment"
5. System will open: https://etas.gov.so/receipt/763816489

---

## E-Visa Testing

### Test Data 1
```
Passport: NXBRJ51J6
Reference: 1764136564
Month: Jan
Year: 2026
URL: https://immigration.etas.gov.so/uploads/2026/Jan/reverified_online_e_visa_pdf/NXBRJ51J6_1764136564.pdf
```

### Test Data 2 (Example)
```
Passport: ABC123456
Reference: 1234567890
Month: Feb
Year: 2026
URL: https://immigration.etas.gov.so/uploads/2026/Feb/reverified_online_e_visa_pdf/ABC123456_1234567890.pdf
```

**How to Test:**
1. Log in as Checker
2. Click "📄 E-Visa" tab
3. Enter passport number
4. Enter reference number
5. Select month and year
6. Click "🔍 Check E-Visa"
7. If found: Download button appears
8. Click "📥 Download E-Visa (PDF)" to open

---

## Checker Login Credentials

### Checker 1
```
Phone: 252612545450
Password: sayidka1
```

### Checker 2
```
Phone: 252900000001
Password: MyChecker123!
```

---

## Super Admin Login

```
Phone: 252618680718
Password: sayidka1
```

**To View All Checks:**
1. Log in as Super Admin
2. Go to `/super-admin`
3. Click "📊 Payment Checks" tab
4. See all checks from all checkers

---

## Test Workflow

### Full Test Scenario

**Step 1: Check Payment (as Checker)**
```
1. Login: 252612545450 / sayidka1
2. Tab: 💳 Payment Receipt
3. Serial: 763816489
4. Click: 🔍 Check Payment
5. Result: Opens https://etas.gov.so/receipt/763816489
```

**Step 2: Check E-Visa (as Checker)**
```
1. Tab: 📄 E-Visa
2. Passport: NXBRJ51J6
3. Reference: 1764136564
4. Month: Jan
5. Year: 2026
6. Click: 🔍 Check E-Visa
7. Result: Shows status + download button if found
```

**Step 3: View as Super Admin**
```
1. Logout
2. Login: 252618680718 / sayidka1
3. Go to: 📊 Payment Checks tab
4. See: All checks from all checkers with:
   - Who checked it
   - What they checked
   - When they checked it
   - Result status
```

---

## Expected Results

### When Document EXISTS
- **Payment**: Opens receipt page
- **E-Visa**: 
  - ✅ "Your visa is ready. You can download it now."
  - 📥 Download button appears
  - Click to open PDF

### When Document NOT FOUND
- **Payment**: May show 404 or error page
- **E-Visa**: 
  - ℹ️ "Your visa is not ready yet, please wait or contact support."
  - No download button

### Always Logged
- All checks saved to database
- Visible in checker's history
- Visible in super admin's all checks view

---

## URL Format Examples

### Payment Receipt
```
https://etas.gov.so/receipt/763816489
https://etas.gov.so/receipt/1234567890
https://etas.gov.so/receipt/9876543210
```

### E-Visa
```
https://immigration.etas.gov.so/uploads/2026/Jan/reverified_online_e_visa_pdf/NXBRJ51J6_1764136564.pdf
https://immigration.etas.gov.so/uploads/2025/Dec/reverified_online_e_visa_pdf/ABC123456_9876543210.pdf
https://immigration.etas.gov.so/uploads/2027/Mar/reverified_online_e_visa_pdf/XYZ789012_1111111111.pdf
```

---

## 🎯 Quick Test Commands

### Test Payment API Directly
```bash
curl -X POST http://localhost:3003/api/payment/check-receipt \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "763816489",
    "checkedBy": "CHECKER_USER_ID"
  }'
```

### Test E-Visa API Directly
```bash
curl -X POST http://localhost:3003/api/payment/check-evisa \
  -H "Content-Type: application/json" \
  -d '{
    "passportNumber": "NXBRJ51J6",
    "referenceNumber": "1764136564",
    "visaYear": "2026",
    "visaMonth": "Jan",
    "checkedBy": "CHECKER_USER_ID"
  }'
```

### View All Checks (Super Admin Only)
```bash
curl http://localhost:3003/api/payment/history?userId=SUPER_ADMIN_ID
```

---

## ✅ Verification Status

- [x] Base URLs match PHP exactly
- [x] Payment URL format correct
- [x] E-Visa URL format correct
- [x] Payment opens directly (like PHP redirect)
- [x] E-Visa checks first, then shows download
- [x] Download button appears when found
- [x] Status messages match PHP
- [x] All checks logged to database
- [x] Super admin can see all checks
- [x] Tested with serial: 763816489

**All PHP functionality preserved and enhanced!** ✅

---

Last Updated: January 24, 2026
