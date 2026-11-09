import sql from 'mssql';

export interface AppSqlTarget {
  server: string;
  database: string;
  token: string;
}

// Fabric reports serverFqdn as "host,port"; the mssql driver takes them separately.
export function parseServer(serverFqdn: string): { server: string; port?: number } {
  const [host, port] = serverFqdn.split(',');
  return port ? { server: host.trim(), port: Number(port) } : { server: host.trim() };
}

/** Opens a connection to the app database as the app identity (AudienceType.Sql) and always closes it. */
export async function withAppSql<T>(target: AppSqlTarget, work: (pool: sql.ConnectionPool) => Promise<T>): Promise<T> {
  const pool = new sql.ConnectionPool({
    ...parseServer(target.server),
    database: target.database,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: { type: 'azure-active-directory-access-token', options: { token: target.token } },
  });
  await pool.connect();
  try {
    return await work(pool);
  } finally {
    await pool.close();
  }
}

export async function isActiveAdmin(pool: sql.ConnectionPool, email: string): Promise<boolean> {
  const result = await pool
    .request()
    .input('email', sql.NVarChar(254), email.trim().toLowerCase())
    .query<{ found: number }>(
      `SELECT COUNT(*) AS found FROM dbo.[Jurors]
       WHERE LOWER(LTRIM(RTRIM(email))) = @email AND role = N'admin' AND active = 1`,
    );
  return (result.recordset[0]?.found ?? 0) > 0;
}
