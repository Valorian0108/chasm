import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
export const pool = hasDatabaseUrl
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;
export const db = pool ? drizzle(pool, { schema }) : null;

// Without a listener an idle-client error is an unhandled 'error' event, which
// terminates the process instead of surfacing the failure.
pool?.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

export * from "./schema";
