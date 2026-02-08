#!/bin/bash

# Script to change all instances of 🛫 to 🇸🇴 (Somalia flag)
# Or change to your preferred emoji/icon

echo "🎨 Immigration Logo Changer"
echo "=========================="
echo ""
echo "Current logo: 🛫 (airplane)"
echo ""
echo "Choose new logo:"
echo "1) 🇸🇴 (Somalia flag)"
echo "2) 📘 (Passport/Document)"
echo "3) 🏛️ (Government Building)"
echo "4) Custom (enter your own)"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
  1)
    NEW_LOGO="🇸🇴"
    ;;
  2)
    NEW_LOGO="📘"
    ;;
  3)
    NEW_LOGO="🏛️"
    ;;
  4)
    read -p "Enter your emoji or HTML: " NEW_LOGO
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "Changing logo to: $NEW_LOGO"
echo ""

# Files to update
FILES=(
  "app/page.tsx"
  "app/admin/page.tsx"
  "app/officer/page.tsx"
  "app/checker/page.tsx"
  "app/super-admin/page.tsx"
  "app/change-password/page.tsx"
)

# Backup originals
BACKUP_DIR="logo_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/"
    # Replace 🛫 with new logo
    sed -i "s/🛫/$NEW_LOGO/g" "$file"
    echo "✅ Updated: $file"
  else
    echo "⚠️  Not found: $file"
  fi
done

echo ""
echo "✅ Logo changed successfully!"
echo "📁 Backups saved to: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Test locally: npm run dev"
echo "3. Build: npm run build"
echo "4. Deploy: rsync to production"
echo ""
