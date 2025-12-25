import { Pool } from "pg";

let readOnlyPool: Pool | null = null;

export function getReadOnlyPool(): Pool {
  if (!readOnlyPool) {
    // Prefer readonly connection string, fall back to main DATABASE_URL
    const connectionString = process.env.DATABASE_URL_READONLY || process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error("DATABASE_URL_READONLY or DATABASE_URL environment variable is not set");
    }
    
    readOnlyPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  
  return readOnlyPool;
}

export async function closeReadOnlyPool() {
  if (readOnlyPool) {
    await readOnlyPool.end();
    readOnlyPool = null;
  }
}
