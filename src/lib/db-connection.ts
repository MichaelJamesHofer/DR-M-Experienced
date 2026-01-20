/**
 * Database connection utility
 * Use this for direct PostgreSQL access (migrations, admin tools, etc.)
 * For forms, use the Supabase client SDK in supabase.ts instead
 */

export function getDatabaseConnectionString(): string | null {
  const password = process.env.SUPABASE_DB_PASSWORD;
  
  if (!password) {
    return null;
  }

  // Your connection string format
  // Replace [YOUR-PASSWORD] with the environment variable
  return `postgresql://postgres.nlzkbrnfvcltgowmeoqm:${password}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`;
}

/**
 * Get connection string components for programmatic use
 */
export function getDatabaseConfig() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  
  if (!password) {
    return null;
  }

  return {
    user: 'postgres.nlzkbrnfvcltgowmeoqm',
    password: password,
    host: 'aws-1-us-east-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    connectionString: `postgresql://postgres.nlzkbrnfvcltgowmeoqm:${password}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
  };
}

