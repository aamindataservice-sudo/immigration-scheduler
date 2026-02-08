import { prisma } from "../lib/prisma";
import crypto from "crypto";

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function main() {
  // Check for existing admin
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (admin) {
    console.log("Found existing ADMIN user:", admin.fullName);
    console.log("Upgrading to SUPER_ADMIN...");
    
    const updated = await prisma.user.update({
      where: { id: admin.id },
      data: {
        role: "SUPER_ADMIN",
        passwordHash: hashPassword("superadmin123"),
        mustChangePassword: false,
      },
    });
    
    console.log("\n✅ User upgraded to SUPER_ADMIN!");
    console.log("Login credentials:");
    console.log("  Phone:", updated.phone);
    console.log("  Password: superadmin123");
  } else {
    console.log("No ADMIN user found. Creating new SUPER_ADMIN...");
    
    const newUser = await prisma.user.create({
      data: {
        fullName: "Super Administrator",
        phone: "252900000000",
        passwordHash: hashPassword("superadmin123"),
        role: "SUPER_ADMIN",
        isActive: true,
        mustChangePassword: false,
      },
    });
    
    console.log("\n✅ SUPER_ADMIN created!");
    console.log("Login credentials:");
    console.log("  Phone:", newUser.phone);
    console.log("  Password: superadmin123");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
