// Script to import users from WhatsApp contacts
// Run with: node scripts/import-users.js

const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const crypto = require("crypto");

// Setup Prisma with adapter
const databaseUrl = process.env.DATABASE_URL || "file:/var/lib/immigration-schedule/prod.db";
const filePath = databaseUrl.replace("file:", "");
const adapter = new PrismaBetterSqlite3({ url: filePath });
const prisma = new PrismaClient({ adapter });

// Password hashing (same as lib/auth.ts)
const HASH_ITERATIONS = 120000;
const HASH_KEYLEN = 64;
const HASH_DIGEST = "sha512";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST)
    .toString("hex");
  return `${salt}:${hash}`;
}

const users = [
  // From image 1
  { name: "Cabdiraxman Caadeey", phone: "252617426159", role: "OFFICER" },
  { name: "Charo", phone: "252611234163", role: "OFFICER" },
  { name: "costa", phone: "252615673556", role: "OFFICER" },
  { name: "Duco waalid hana taay", phone: "252615065616", role: "OFFICER" },
  { name: "Guled Mohamed Hassan", phone: "252615627533", role: "OFFICER" },
  { name: "Halcad", phone: "252612632829", role: "OFFICER" },
  { name: "Hamse", phone: "252616888409", role: "OFFICER" },
  { name: "Ikran Abdi", phone: "252614327454", role: "OFFICER" },
  
  // From image 2
  { name: "Seyd Omar", phone: "252615621391", role: "OFFICER" },
  { name: "Suldamada", phone: "252615755939", role: "OFFICER" },
  { name: "Suweys Abdi", phone: "252619605646", role: "OFFICER" },
  { name: "Taakow Duceysane", phone: "252616549167", role: "OFFICER" },
  { name: "wayel", phone: "252611575691", role: "OFFICER" },
  { name: "weheliye mohammad", phone: "252618949596", role: "OFFICER" },
  { name: "Yasin", phone: "252615602512", role: "OFFICER" },
  { name: "Yasmin Osman", phone: "252619626475", role: "OFFICER" },
  
  // From image 3
  { name: "Abdirahman Ali Kaar", phone: "252613853791", role: "ADMIN" },
  { name: "Abdinasir Galbeed", phone: "252615626497", role: "OFFICER" },
  { name: "abdiqdirmohamed", phone: "252629122888", role: "OFFICER" },
  { name: "Adam Said", phone: "252615992457", role: "OFFICER" },
  { name: "Ahmed DERIE", phone: "252617065907", role: "OFFICER" },
  { name: "Amusane", phone: "252610847487", role: "OFFICER" },
  { name: "Awoowe", phone: "252615194134", role: "OFFICER" },
  
  // From image 5
  { name: "Kasim Saman", phone: "252616362243", role: "OFFICER" },
  { name: "Maamaan", phone: "252617551550", role: "OFFICER" },
  { name: "Mahamed lidi Aamiin", phone: "252615969951", role: "OFFICER" },
  { name: "Mohamed", phone: "252612734594", role: "OFFICER" },
  { name: "mr baab", phone: "252619477282", role: "OFFICER" },
  { name: "Omar", phone: "252615458169", role: "OFFICER" },
  { name: "Qalbi Xab Xab", phone: "252615164549", role: "OFFICER" },
  { name: "Sareeye", phone: "252618332444", role: "OFFICER" },
];

async function main() {
  console.log("Starting user import...");
  console.log(`Database: ${filePath}`);
  
  const defaultOfficerPassword = hashPassword("officer123");
  const defaultAdminPassword = hashPassword("admin123");
  
  let created = 0;
  let skipped = 0;
  
  for (const user of users) {
    try {
      // Check if user already exists
      const existing = await prisma.user.findFirst({
        where: { phone: user.phone }
      });
      
      if (existing) {
        console.log(`Skipped (exists): ${user.name} - ${user.phone}`);
        skipped++;
        continue;
      }
      
      await prisma.user.create({
        data: {
          fullName: user.name,
          phone: user.phone,
          passwordHash: user.role === "ADMIN" ? defaultAdminPassword : defaultOfficerPassword,
          role: user.role,
          isActive: true,
          mustChangePassword: true,
        }
      });
      
      console.log(`Created: ${user.name} - ${user.phone} (${user.role})`);
      created++;
    } catch (e) {
      console.error(`Error creating ${user.name}: ${e.message}`);
    }
  }
  
  console.log(`\nImport complete: ${created} created, ${skipped} skipped`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
