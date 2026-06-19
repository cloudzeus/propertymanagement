import { PrismaClient } from "./prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

declare global {
  var prisma: PrismaClient | undefined;
}

export const db = global.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
