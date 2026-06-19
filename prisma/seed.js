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
            id: "costs",
            label: "API Costs",
            icon: "dollar-sign",
            href: "/super-admin/settings/costs",
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

    // Create test company for other roles
    let testCompany = await prisma.company.findFirst({
      where: { slug: "test-company" },
    });

    if (!testCompany) {
      testCompany = await prisma.company.create({
        data: {
          name: "Test Company",
          slug: "test-company",
          subscriptionTier: "PROFESSIONAL",
          status: "TRIAL",
          maxProperties: 10,
          maxUsers: 50,
          maxStorage: 100,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        },
      });
      console.log("✅ Test company created");
    }

    // Create test users for all roles
    const roles = [
      { role: "ADMIN", name: "Admin User", email: "admin@test.com" },
      { role: "MANAGER", name: "Manager User", email: "manager@test.com" },
      { role: "EMPLOYEE", name: "Employee User", email: "employee@test.com" },
      { role: "PROPERTY_ADMIN", name: "Property Admin", email: "property-admin@test.com" },
      { role: "PROPERTY_OWNER", name: "Property Owner", email: "property-owner@test.com" },
      { role: "PROPERTY_RESIDENT", name: "Property Resident", email: "property-resident@test.com" },
      { role: "PROPERTY_VIEWER", name: "Property Viewer", email: "property-viewer@test.com" },
      { role: "COLLABORATOR", name: "Collaborator User", email: "collaborator@test.com" },
    ];

    const testPassword = "password123";
    const hashedTestPassword = await bcrypt.hash(testPassword, 10);

    for (const roleData of roles) {
      const existingUser = await prisma.user.findUnique({
        where: { email: roleData.email },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            email: roleData.email,
            name: roleData.name,
            passwordHash: hashedTestPassword,
            role: roleData.role,
            status: "ACTIVE",
            companyId: testCompany.id,
          },
        });
        console.log(`✅ Created ${roleData.role} user: ${roleData.email}`);
      }
    }

    // Create menu configs for all roles
    const menuConfigs = [
      {
        role: "ADMIN",
        menuItems: [
          { id: "dashboard", label: "Dashboard", icon: "home", href: "/admin" },
          { id: "companies", label: "Companies", icon: "building", href: "/admin/companies" },
          { id: "users", label: "Users", icon: "users", href: "/admin/users" },
          { id: "settings", label: "Settings", icon: "settings", href: "/admin/settings" },
        ],
      },
      {
        role: "MANAGER",
        menuItems: [
          { id: "dashboard", label: "Dashboard", icon: "home", href: "/manager" },
          { id: "teams", label: "Teams", icon: "users", href: "/manager/teams" },
          { id: "reports", label: "Reports", icon: "chart", href: "/manager/reports" },
        ],
      },
      {
        role: "EMPLOYEE",
        menuItems: [
          { id: "dashboard", label: "Dashboard", icon: "home", href: "/employee" },
          { id: "tasks", label: "Tasks", icon: "check-square", href: "/employee/tasks" },
        ],
      },
      {
        role: "PROPERTY_ADMIN",
        menuItems: [
          { id: "dashboard", label: "Dashboard", icon: "home", href: "/property-admin" },
          { id: "properties", label: "Properties", icon: "building", href: "/property-admin/properties" },
          { id: "units", label: "Units", icon: "square", href: "/property-admin/units" },
          { id: "residents", label: "Residents", icon: "users", href: "/property-admin/residents" },
          { id: "maintenance", label: "Maintenance", icon: "wrench", href: "/property-admin/maintenance" },
        ],
      },
      {
        role: "PROPERTY_OWNER",
        menuItems: [
          { id: "dashboard", label: "Dashboard", icon: "home", href: "/property-owner" },
          { id: "properties", label: "My Properties", icon: "building", href: "/property-owner/properties" },
          { id: "billing", label: "Billing", icon: "dollar-sign", href: "/property-owner/billing" },
        ],
      },
      {
        role: "PROPERTY_RESIDENT",
        menuItems: [
          { id: "announcements", label: "Announcements", icon: "bell", href: "/property-resident/announcements" },
          { id: "billing", label: "Billing", icon: "file-text", href: "/property-resident/billing" },
          { id: "maintenance", label: "Maintenance", icon: "tools", href: "/property-resident/maintenance" },
        ],
      },
      {
        role: "PROPERTY_VIEWER",
        menuItems: [
          { id: "announcements", label: "Announcements", icon: "bell", href: "/property-viewer/announcements" },
        ],
      },
      {
        role: "COLLABORATOR",
        menuItems: [
          { id: "dashboard", label: "Dashboard", icon: "home", href: "/collaborator" },
          { id: "tasks", label: "Assigned Tasks", icon: "check-square", href: "/collaborator/tasks" },
        ],
      },
    ];

    for (const config of menuConfigs) {
      const existingConfig = await prisma.menuConfig.findFirst({
        where: { role: config.role },
      });

      if (!existingConfig) {
        await prisma.menuConfig.create({
          data: {
            role: config.role,
            menuItems: config.menuItems,
            isDefault: true,
          },
        });
        console.log(`✅ Created menu config for ${config.role}`);
      }
    }

    // Create default pricing tiers
    const existingPricing = await prisma.pricingTier.findFirst();

    if (!existingPricing) {
      await prisma.pricingTier.createMany({
        data: [
          {
            name: "Starter",
            slug: "starter",
            description: "Perfect for property managers just getting started",
            monthlyPrice: 29,
            annualPrice: 290,
            features: [
              "Up to 5 properties",
              "Up to 50 units",
              "Up to 10 team members",
              "Basic maintenance tracking",
              "Rent collection",
              "Tenant portal",
              "Mobile app access",
              "Email support",
            ],
            highlighted: false,
            order: 1,
            published: true,
          },
          {
            name: "Professional",
            slug: "professional",
            description: "For growing property management teams",
            monthlyPrice: 79,
            annualPrice: 790,
            features: [
              "Up to 20 properties",
              "Up to 500 units",
              "Up to 50 team members",
              "Advanced maintenance tracking",
              "Automated rent collection",
              "Financial reporting",
              "Custom workflows",
              "Advanced analytics",
              "API access",
              "Priority email support",
              "Monthly check-ins",
            ],
            highlighted: true,
            order: 2,
            published: true,
          },
          {
            name: "Enterprise",
            slug: "enterprise",
            description: "For large-scale property management operations",
            monthlyPrice: null,
            annualPrice: null,
            features: [
              "Unlimited properties",
              "Unlimited units",
              "Unlimited team members",
              "All Professional features",
              "Dedicated account manager",
              "Custom integrations",
              "White-label options",
              "Advanced security",
              "Dedicated support line",
              "Training and onboarding",
              "SLA guarantees",
            ],
            highlighted: false,
            order: 3,
            published: true,
          },
        ],
      });

      console.log("✅ Default pricing tiers created");
    } else {
      console.log("✅ Pricing tiers already exist");
    }

    console.log("\n🎉 Database seed completed successfully!");
    console.log("\n📝 Login credentials:");
    console.log("\n🔐 SUPER_ADMIN:");
    console.log(`   Email: ${superAdminEmail}`);
    console.log(`   Password: ${superAdminPassword}`);
    console.log("\n👥 Test Users (for all other roles):");
    console.log(`   Password: ${testPassword} (same for all)`);
    console.log("   Emails:");
    roles.forEach((role) => {
      console.log(`     - ${role.email} (${role.role})`);
    });
    console.log("\n⚠️  Change these passwords after first login!");
    console.log("📌 Test Company: 'Test Company' (slug: test-company)");
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
