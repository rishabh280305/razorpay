import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { agentreadySql?: ReturnType<typeof postgres>; agentreadyDb?: ReturnType<typeof drizzle<typeof schema>> };
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!globalDb.agentreadySql) globalDb.agentreadySql = postgres(url, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  if (!globalDb.agentreadyDb) globalDb.agentreadyDb = drizzle(globalDb.agentreadySql, { schema });
  return globalDb.agentreadyDb;
}
