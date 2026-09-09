import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, PoolConfig } from "pg";
import { PrismaClient } from "../../generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getPoolConfig(): PoolConfig {
  if (process.env.PGHOST?.startsWith("/")) {
    return {
      host: process.env.PGHOST,
      user: process.env.PGUSER || process.env.USER,
      database: process.env.PGDATABASE || "khan_sofa",
    };
  }

  return { connectionString: process.env.DATABASE_URL };
}

function createPrismaClient() {
  const pool = new Pool(getPoolConfig());
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function createPool() {
  return new Pool(getPoolConfig());
}
