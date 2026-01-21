const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");
const Database = require("better-sqlite3");

const databaseUrl = process.env.DATABASE_URL ?? "file:/var/lib/immigration-schedule/prod.db";
const filePath = databaseUrl.replace("file:", "");
const adapter = new PrismaBetterSqlite3({ url: filePath });
const prisma = new PrismaClient({ adapter });

async function main() {
  const deleted = await prisma.shiftRule.deleteMany({});
  console.log('Deleted', deleted.count, 'old rules');
  await prisma.$disconnect();
}

main().catch(console.error);
