import { loadEnvFiles } from "../env/load-env";
import { defineConfig } from "drizzle-kit";
import path from "path";

loadEnvFiles();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
