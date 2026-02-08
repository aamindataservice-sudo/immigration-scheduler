#!/usr/bin/env node

/**
 * Create a Super Admin user
 * Usage: node scripts/create-super-admin.js
 */

const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const crypto = require("crypto");
const readline = require("readline");

const databaseUrl = process.env.DATABASE_URL ?? "file:/var/lib/immigration-schedule/prod.db";
const filePath = databaseUrl.replace("file:", "");
const adapter = new PrismaBetterSqlite3({ url: filePath });

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

// Simple password hashing (matches your existing auth.ts)
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log("\n🔐 Create Super Admin User\n");
  console.log("This will create a new SUPER_ADMIN user.\n");

  const fullName = await question("Full Name: ");
  const phone = await question("Phone Number (e.g. 252xxxxxxxxx): ");
  const password = await question("Password (leave empty for 'superadmin123'): ");

  const finalPassword = password.trim() || "superadmin123";

  console.log("\nCreating super admin user...");

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      console.log("\n❌ Error: User with this phone number already exists.");
      
      const upgrade = await question("\nUpgrade existing user to SUPER_ADMIN? (yes/no): ");
      
      if (upgrade.toLowerCase() === "yes" || upgrade.toLowerCase() === "y") {
        const updated = await prisma.user.update({
          where: { phone },
          data: {
            role: "SUPER_ADMIN",
            passwordHash: hashPassword(finalPassword),
            mustChangePassword: false,
          },
        });
        
        console.log("\n✅ User upgraded to SUPER_ADMIN successfully!");
        console.log("\nUser Details:");
        console.log("  Name:", updated.fullName);
        console.log("  Phone:", updated.phone);
        console.log("  Role:", updated.role);
        console.log("\nYou can now log in with this account.");
      } else {
        console.log("\nOperation cancelled.");
      }
      
      rl.close();
      await prisma.$disconnect();
      return;
    }

    // Create new super admin
    const user = await prisma.user.create({
      data: {
        fullName,
        phone,
        passwordHash: hashPassword(finalPassword),
        role: "SUPER_ADMIN",
        isActive: true,
        mustChangePassword: false,
      },
    });

    console.log("\n✅ Super Admin created successfully!");
    console.log("\nUser Details:");
    console.log("  ID:", user.id);
    console.log("  Name:", user.fullName);
    console.log("  Phone:", user.phone);
    console.log("  Role:", user.role);
    console.log("\n📱 Login Credentials:");
    console.log("  Phone:", phone);
    console.log("  Password:", finalPassword);
    console.log("\nYou can now log in to the system.");
  } catch (error) {
    console.error("\n❌ Error creating super admin:", error.message);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();
