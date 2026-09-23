#!/usr/bin/env node
/* Sync the single admin account with ADMIN_EMAIL / ADMIN_PASSWORD /
   ADMIN_NAME from the environment and revoke every existing session.
   Useful after changing ADMIN_PASSWORD or when bootstrap credentials are lost. */

const bcrypt = require("bcryptjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../generated/prisma");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@rendivirgo.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Rendi Virgo";

  if (!password || password.length < 8) {
    console.error("ADMIN_PASSWORD is required and must be at least 8 characters");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, name, passwordHash },
  });

  const revoked = await prisma.adminSession.updateMany({
    where: { adminId: admin.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log(`Admin ready: ${admin.email}`);
  console.log(`Password hash updated, ${revoked.count} session(s) revoked.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
