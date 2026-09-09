import "dotenv/config";
import { execSync } from "child_process";
import { Pool, PoolConfig } from "pg";

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

async function pushSchema() {
  console.log("Generating SQL from Prisma schema...");
  const sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
    { encoding: "utf-8", cwd: process.cwd() }
  );

  console.log("Applying schema to database...");
  const pool = new Pool(getPoolConfig());
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Schema applied successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

pushSchema().catch((error) => {
  console.error(error);
  process.exit(1);
});
