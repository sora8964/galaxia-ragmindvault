import 'dotenv/config';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// 根據環境選擇不同的資料庫驅動
const isLocal = process.env.NODE_ENV === 'development' && process.env.DATABASE_URL.includes('localhost');

let pool: any;
let db: any;

if (isLocal) {
  // 本機環境使用標準 PostgreSQL 驅動
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  // 生產環境使用 Neon serverless 驅動
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-serverless');
  const ws = await import("ws");
  
  neonConfig.webSocketConstructor = ws.default;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

export { pool, db };
