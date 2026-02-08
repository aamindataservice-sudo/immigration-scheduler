# Super Admin & Payment Checker Setup

This document explains the new Super Admin and Checker user functionality added to the Immigration Scheduler system.

## Overview

The system now includes two new user roles:
1. **SUPER_ADMIN** - Has full administrative access and can create/manage CHECKER users
2. **CHECKER** - Can check payment receipts and e-Visa status

## User Roles Hierarchy

1. **SUPER_ADMIN** - Top-level admin, can create CHECKER users, view all work
2. **ADMIN** - Original admin role for shift management
3. **CHECKER** - Payment/e-Visa verification specialist
4. **OFFICER** - Regular immigration officer

## New Features

### 1. Payment Receipt Verification
Checkers can verify if a payment receipt exists by serial number.
- **API Endpoint**: `/api/payment/check-receipt`
- **Source**: Checks `https://etas.gov.so/receipt/{serialNumber}`
- **Returns**: FOUND, NOT_FOUND, or ERROR status

### 2. E-Visa Verification
Checkers can verify if an e-Visa PDF is ready for download.
- **API Endpoint**: `/api/payment/check-evisa`
- **Source**: Checks `https://immigration.etas.gov.so/uploads/{year}/{month}/reverified_online_e_visa_pdf/{passport}_{reference}.pdf`
- **Returns**: FOUND, NOT_FOUND, or ERROR status

### 3. Payment Check History
All payment checks are logged in the database and can be viewed:
- **Checker Dashboard**: Shows their own checks
- **Super Admin Dashboard**: Shows ALL checks from all checkers

## Database Changes

### New Enums
```prisma
enum UserRole {
  SUPER_ADMIN
  ADMIN
  CHECKER
  OFFICER
}

enum PaymentType {
  PAYMENT_RECEIPT
  EVISA
}

enum PaymentStatus {
  FOUND
  NOT_FOUND
  ERROR
}
```

### New Model: PaymentCheck
```prisma
model PaymentCheck {
  id              String        @id @default(cuid())
  type            PaymentType
  serialNumber    String?
  passportNumber  String?
  referenceNumber String?
  visaYear        String?
  visaMonth       String?
  status          PaymentStatus
  resultUrl       String?
  checkedBy       String
  checkedByUser   User          @relation(...)
  createdAt       DateTime      @default(now())
}
```

## API Endpoints

### 1. Check Payment Receipt
**POST** `/api/payment/check-receipt`
```json
{
  "serialNumber": "1763816489",
  "checkedBy": "user_id_here"
}
```

**Response:**
```json
{
  "ok": true,
  "check": {
    "id": "check_id",
    "status": "FOUND",
    "receiptUrl": "https://etas.gov.so/receipt/1763816489",
    "message": "Payment receipt found"
  }
}
```

### 2. Check E-Visa
**POST** `/api/payment/check-evisa`
```json
{
  "passportNumber": "NXBRJ51J6",
  "referenceNumber": "1764136564",
  "visaYear": "2026",
  "visaMonth": "Jan",
  "checkedBy": "user_id_here"
}
```

**Response:**
```json
{
  "ok": true,
  "check": {
    "id": "check_id",
    "status": "FOUND",
    "visaUrl": "https://immigration.etas.gov.so/uploads/2026/Jan/reverified_online_e_visa_pdf/NXBRJ51J6_1764136564.pdf",
    "message": "E-Visa found and ready for download"
  }
}
```

### 3. Get My Checks (Checker)
**GET** `/api/payment/my-checks?userId={userId}&limit=50`

Returns the checker's own payment check history.

### 4. Get All Checks (Super Admin Only)
**GET** `/api/payment/history?userId={superAdminId}&limit=100`

Returns all payment checks from all checkers. Only accessible to SUPER_ADMIN.

## Dashboards

### 1. Super Admin Dashboard
**Route**: `/super-admin`

Features:
- ✅ Create new CHECKER users
- ✅ View all users (checkers and others)
- ✅ Activate/deactivate checker accounts
- ✅ View ALL payment checks from all checkers
- ✅ See who checked what and when

### 2. Checker Dashboard
**Route**: `/checker`

Features:
- 💳 Check payment receipts by serial number
- 📄 Check e-Visa status by passport/reference
- 📋 View own check history
- 🔍 Automatic URL opening when documents found

### 3. Admin Dashboard (unchanged)
**Route**: `/admin`

Original shift management features remain the same.

### 4. Officer Dashboard (unchanged)
**Route**: `/officer`

Original officer features remain the same.

## Creating Your First Super Admin

### Option 1: Through Database
If you already have an admin user, update their role:

```sql
UPDATE User SET role = 'SUPER_ADMIN' WHERE phone = '252xxxxxxxxx';
```

### Option 2: Bootstrap (if no users exist)
The first user created through the bootstrap process can be manually upgraded to SUPER_ADMIN.

## Creating Checker Users

Only SUPER_ADMIN can create CHECKER users:

1. Log in as SUPER_ADMIN
2. Go to "Users & Checkers" tab
3. Click "➕ Create Checker"
4. Fill in:
   - Full Name
   - Phone Number
   - Password (optional, defaults to "checker123")
5. Click "Create Checker"

## Payment Verification Flow

### For Checkers:
1. Log in to checker dashboard
2. Choose tab: "💳 Payment Receipt" or "📄 E-Visa"
3. Enter required information
4. Click check button
5. If found, document opens in new tab
6. Check is logged in history

### For Super Admins:
1. Log in to super admin dashboard
2. Go to "📊 Payment Checks" tab
3. View all checks from all checkers
4. See full details including:
   - Who checked it
   - When it was checked
   - What was the result
   - Link to view the document

## Security Features

- ✅ Only CHECKER and SUPER_ADMIN can check payments
- ✅ Only SUPER_ADMIN can create CHECKER users
- ✅ Only SUPER_ADMIN can view all payment checks
- ✅ All checks are logged with user attribution
- ✅ Authentication required for all endpoints
- ✅ Role-based access control

## PHP to Node.js Conversion

The original PHP payment checking code has been converted to Node.js:

**Original PHP Logic:**
```php
// Check payment receipt
$paymentBaseUrl = 'https://etas.gov.so/receipt/';
$target = $paymentBaseUrl . urlencode($serial);
$headers = @get_headers($target);
$exists = strpos($headers[0], '200') !== false;

// Check e-Visa
$visaBaseUrl = 'https://immigration.etas.gov.so/uploads/';
$visaUrl = $visaBaseUrl . $year . '/' . $month . '/reverified_online_e_visa_pdf/' . $passport . '_' . $reference . '.pdf';
$visaReady = urlExists($visaUrl);
```

**New Node.js Implementation:**
```typescript
// Check if URL exists
const response = await fetch(url, { method: "HEAD" });
if (response.ok && response.status === 200) {
  status = "FOUND";
  resultUrl = url;
}
```

## Testing

### Test Checker Creation:
1. Create a super admin user
2. Log in and create a checker user
3. Log out and log in as the checker
4. Verify you can access `/checker` dashboard

### Test Payment Checking:
1. Log in as checker
2. Try checking a payment with a known serial number
3. Verify the check appears in history
4. Log in as super admin
5. Verify you can see the check in "Payment Checks" tab

## File Structure

```
/var/www/immigration-schedule/
├── prisma/
│   └── schema.prisma                    # Updated with new roles & PaymentCheck model
├── app/
│   ├── api/
│   │   └── payment/
│   │       ├── check-receipt/route.ts   # Check payment receipt
│   │       ├── check-evisa/route.ts     # Check e-Visa
│   │       ├── my-checks/route.ts       # Get checker's own checks
│   │       └── history/route.ts         # Get all checks (super admin)
│   ├── super-admin/
│   │   └── page.tsx                     # Super Admin dashboard
│   ├── checker/
│   │   └── page.tsx                     # Checker dashboard
│   ├── admin/
│   │   └── page.tsx                     # Admin dashboard (unchanged)
│   ├── officer/
│   │   └── page.tsx                     # Officer dashboard (unchanged)
│   └── page.tsx                         # Login page (updated routing)
└── SUPER_ADMIN_SETUP.md                 # This file
```

## Default Passwords

- **Super Admin**: (set manually)
- **Admin**: `admin123`
- **Checker**: `checker123` (if not specified during creation)
- **Officer**: `officer123`

## Notes

- All timestamps are stored in UTC
- Payment checks are never deleted (audit trail)
- Inactive checkers cannot perform checks
- All checks require valid authentication
- External URLs are checked with HEAD requests to avoid downloading files

## Future Enhancements

Possible additions:
- [ ] Bulk payment checking
- [ ] Export check history to CSV
- [ ] Email notifications for found documents
- [ ] OCR for passport number extraction
- [ ] Statistics dashboard for checks
- [ ] Rate limiting for external URL checks

---

**Last Updated**: January 24, 2026
**Version**: 1.0.0
