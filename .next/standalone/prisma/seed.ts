import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const DEFAULT_CATEGORIES: Array<{
  name: string;
  unit: string;
  materials: Array<{ name: string; defaultUnit: string; hsnCode?: string }>;
}> = [
  {
    name: "Plumbing",
    unit: "NOS",
    materials: [
      { name: "PVC Pipe 4 inch", defaultUnit: "NOS" },
      { name: "CPVC Elbow 1 inch", defaultUnit: "NOS" },
    ],
  },
  {
    name: "Steel",
    unit: "KG",
    materials: [
      { name: "TMT Rod 8mm", defaultUnit: "KG" },
      { name: "TMT Rod 12mm", defaultUnit: "KG" },
      { name: "TMT Rod 16mm", defaultUnit: "KG" },
    ],
  },
  {
    name: "Cement",
    unit: "BAG",
    materials: [{ name: "OPC 53 Grade Cement", defaultUnit: "BAG" }],
  },
  {
    name: "Tiles",
    unit: "NOS",
    materials: [{ name: "Vitrified Tile 600x600", defaultUnit: "NOS" }],
  },
  {
    name: "Sanitaryware",
    unit: "NOS",
    materials: [{ name: "Jaquar Wall Mixer", defaultUnit: "NOS" }],
  },
  {
    name: "Tile Adhesive",
    unit: "BAG",
    materials: [
      { name: "Sumeru Unique 501 40Kg", defaultUnit: "BAG", hsnCode: "38244090" },
    ],
  },
  {
    name: "Marble/Granite",
    unit: "SQFT",
    materials: [{ name: "Amaze Marble", defaultUnit: "SQFT" }],
  },
  {
    name: "Misc",
    unit: "NOS",
    materials: [],
  },
];

async function main() {
  console.log("Seeding categories & materials...");
  for (const category of DEFAULT_CATEGORIES) {
    const created = await db.category.upsert({
      where: { name: category.name },
      update: {},
      create: { name: category.name, unit: category.unit },
    });

    for (const material of category.materials) {
      await db.material.upsert({
        where: { categoryId_name: { categoryId: created.id, name: material.name } },
        update: {},
        create: {
          categoryId: created.id,
          name: material.name,
          defaultUnit: material.defaultUnit,
          hsnCode: material.hsnCode,
        },
      });
    }
  }

  console.log("Seeding demo project...");
  const project = await db.project.upsert({
    where: { id: "demo-project" },
    update: {},
    create: { id: "demo-project", name: "Sanvicasa Saharsh", address: "" },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@sanvicasagroup.in";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin@sanvicasa26";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  console.log(`Seeding admin user (${adminEmail})...`);
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  const staffEmail = process.env.SEED_STAFF_EMAIL ?? "staff@sanvicasagroup.in";
  const staffPassword = process.env.SEED_STAFF_PASSWORD ?? "staff@sanvicasa26";
  const staffPasswordHash = await bcrypt.hash(staffPassword, 12);

  console.log(`Seeding staff user (${staffEmail})...`);
  const staff = await db.user.upsert({
    where: { email: staffEmail },
    update: {},
    create: {
      email: staffEmail,
      name: "Staff",
      passwordHash: staffPasswordHash,
      role: "STAFF",
    },
  });

  await db.projectAssignment.upsert({
    where: { userId_projectId: { userId: staff.id, projectId: project.id } },
    update: {},
    create: { userId: staff.id, projectId: project.id },
  });

  console.log("Seed complete.");
  console.log(`  Admin login: ${admin.email} / ${adminPassword}`);
  console.log(`  Staff login: ${staff.email} / ${staffPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
