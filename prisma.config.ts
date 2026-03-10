import { defineConfig } from "prisma/config";

// Load .env for the Prisma CLI context
const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
