import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { seedTagsAndNav } from "../prisma/seed-tags";

const pool = new Pool(
  process.env.PGHOST?.startsWith("/")
    ? {
        host: process.env.PGHOST,
        user: process.env.PGUSER || process.env.USER,
        database: process.env.PGDATABASE || "khan_sofa",
      }
    : { connectionString: process.env.DATABASE_URL! }
);

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

seedTagsAndNav(prisma)
  .then(() => console.log("Tags and navigation seeded"))
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
