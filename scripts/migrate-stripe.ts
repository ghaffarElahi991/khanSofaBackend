import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
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

async function main() {
  const sql = readFileSync(path.join(__dirname, "migrate-stripe.sql"), "utf-8");
  const pool = new Pool(getPoolConfig());
  const client = await pool.connect();

  try {
    await client.query(sql);
    console.log("Stripe migration applied");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
