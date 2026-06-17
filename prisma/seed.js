const { PrismaClient } = require("../node_modules/@prisma/client");
const bcrypt = require("bcryptjs");

// Copy generated client to node_modules if needed
const fs = require("fs");
const path = require("path");

const generatedPath = path.join(__dirname, "../.prisma/client");
const expectedPath = path.join(__dirname, "../node_modules/.prisma/client");

if (fs.existsSync(generatedPath) && !fs.existsSync(path.join(expectedPath, "default.ts"))) {
  console.log("📋 Setting up generated Prisma client...");
  // The generated client is already at node_modules/.prisma/client from our copy
}

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create SUPER_ADMIN user
  const superAdminEmail = "gkozyris@i4ria.com";
  const superAdminPassword = "1f1femsk";

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: superAdminEmail },
    });

    if (existingUser) {
      console.log(`✅ SUPER_ADMIN user already exists: ${superAdminEmail}`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

    // Create SUPER_ADMIN user
    const superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        name: "Super Administrator",
        passwordHash: hashedPassword,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });

    console.log("✅ SUPER_ADMIN user created successfully!");
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   Status: ${superAdmin.status}`);
    console.log(`   Created at: ${superAdmin.createdAt}`);

    // Create default menu config for SUPER_ADMIN
    await prisma.menuConfig.create({
      data: {
        role: "SUPER_ADMIN",
        menuItems: [
          {
            id: "dashboard",
            label: "Dashboard",
            icon: "home",
            href: "/super-admin",
          },
          {
            id: "companies",
            label: "Companies",
            icon: "building",
            href: "/super-admin/companies",
          },
          {
            id: "ai-tools",
            label: "AI Tools",
            icon: "zap",
            href: "/super-admin/ai-tools",
          },
          {
            id: "integrations",
            label: "Integrations",
            icon: "link",
            href: "/super-admin/integrations",
          },
          {
            id: "settings",
            label: "Settings",
            icon: "settings",
            href: "/super-admin/settings",
          },
        ],
        isDefault: true,
      },
    });

    console.log("✅ Default menu config created for SUPER_ADMIN");

    console.log("\n🎉 Database seed completed successfully!");
    console.log("\n📝 Login credentials:");
    console.log(`   Email: ${superAdminEmail}`);
    console.log(`   Password: ${superAdminPassword}`);
    console.log("\n⚠️  Change this password after first login!");
  } catch (error) {
    console.error("❌ Seeding error:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
