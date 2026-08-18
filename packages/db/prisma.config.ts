import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.resolve(__dirname, "../../apps");
const envPath =
  process.env.DB_TARGET === "marketing"
    ? path.join(envDir, "marketing/.env")
    : path.join(envDir, "web/.env");
dotenv.config({ path: envPath });

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Use process.env so prisma generate works without .env (e.g. fresh clone)
    url: process.env.DIRECT_URL ?? "postgresql://localhost:5432/placeholder",
  },
});
