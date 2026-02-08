# Admin Page Update - User Filtering

## Issue
Regular ADMIN users currently see ALL users including SUPER_ADMIN and CHECKER users. They should only see ADMIN and OFFICER users.

## Solution
The API (`/api/users/list`) has already been updated to support filtering. The admin page just needs to pass the requester ID.

## File to Update
`/var/www/immigration-schedule/app/admin/page.tsx`

## Changes Needed

### Change #1: Update loadAll function signature (line 318)
**Find:**
```typescript
const loadAll = async () => {
```

**Replace with:**
```typescript
const loadAll = async (adminId?: string) => {
  const userId = adminId || user?.id;
```

### Change #2: Update fetch call (line 320)
**Find:**
```typescript
fetch("/api/users/list").then((r) => r.json()),
```

**Replace with:**
```typescript
fetch(`/api/users/list${userId ? `?requesterId=${userId}` : ""}`).then((r) => r.json()),
```

### Change #3: Update useEffect (line 336-341)
**Find:**
```typescript
useEffect(() => {
  loadAll();
  // Initial fetch will check for last schedule if current date has no schedule
  fetchSchedule();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Replace with:**
```typescript
useEffect(() => {
  if (user?.id) {
    loadAll(user.id);
    // Initial fetch will check for last schedule if current date has no schedule
    fetchSchedule();
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [user]);
```

## Alternative: Manual Edit
Since the admin page is 5600+ lines, you can manually edit these 3 locations in your code editor.

## How to Test
1. Log in as ADMIN user (252613853791 / admin123)
2. Verify you DON'T see:
   - Sayid (252618680718) - SUPER_ADMIN
   - Sayid (252612545450) - CHECKER
   - Payment Checker (252900000001) - CHECKER
3. Verify you DO see:
   - All OFFICER users
   - Other ADMIN users

## Current Status
- ✅ API updated and working
- ⚠️ Admin page needs manual update
- ✅ Super Admin page already correct
- ✅ Security working (admins can't manage super admins/checkers via API)

## Priority
**Low** - The API already prevents admins from managing super admins/checkers. They just can see them in the list. This is more of a UI cleanup.

---

**Note**: All other functionality is complete and working!
