import "dotenv/config";
import { Client, type ClientConfig } from "pg";

const DEFAULT_DATABASE = "khan_sofa";

function targetDatabase() {
  if (process.env.PGDATABASE) return process.env.PGDATABASE;

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return decodeURIComponent(url.pathname.replace(/^\//, "")) || DEFAULT_DATABASE;
  }

  return DEFAULT_DATABASE;
}

function adminConnection(): ClientConfig {
  if (process.env.DATABASE_ADMIN_URL) {
    return { connectionString: process.env.DATABASE_ADMIN_URL };
  }

  if (process.env.PGHOST?.startsWith("/")) {
    return {
      host: process.env.PGHOST,
      user: process.env.PGUSER || process.env.USER,
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
      database: process.env.PGADMIN_DATABASE || "postgres",
    };
  }

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/postgres";
    url.searchParams.delete("schema");
    return { connectionString: url.toString() };
  }

  return { database: "postgres" };
}

async function createDatabase() {
  const database = targetDatabase();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) {
    throw new Error(`Unsafe PostgreSQL database name: ${database}`);
  }

  const client = new Client(adminConnection());
  await client.connect();

  try {
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [database]
    );

    if (existing.rowCount) {
      console.log(`Database \"${database}\" already exists`);
      return;
    }

    await client.query(`CREATE DATABASE \"${database}\"`);
    console.log(`Created database \"${database}\"`);
  } finally {
    await client.end();
  }
}

createDatabase().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
