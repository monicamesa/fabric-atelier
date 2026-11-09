import { randomUUID } from 'node:crypto';
import sql from 'mssql';

// Spike S-A/S-B helpers. Removed in I1b, when the admin Function replaces them.

export interface SqlTarget {
  server: string;
  database: string;
  token: string;
}

export interface SpikeSqlResult {
  jurorId: string;
  jurorEmail: string;
  readBackMatches: boolean;
  exampleAgentReady: boolean;
  columns: Record<string, string[]>;
  error?: string;
}

const ENTITY_TABLES = ['Juror', 'Agent', 'Case', 'Testimony', 'CaseDismissal'];
const EXAMPLE_AGENT_ID = '00000000-0000-4000-8000-000000000021';
const EXAMPLE_PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000031';

function quoteIdentifier(name: string): string {
  return `[${name.replace(/]/g, ']]')}]`;
}

// Fabric reports serverFqdn as "host,port"; the mssql driver takes them separately.
export function parseServer(serverFqdn: string): { server: string; port?: number } {
  const [host, port] = serverFqdn.split(',');
  return port ? { server: host.trim(), port: Number(port) } : { server: host.trim() };
}

export async function runSqlSpike(target: SqlTarget): Promise<SpikeSqlResult> {
  const jurorId = randomUUID();
  const jurorEmail = `spike-${Date.now()}@example.com`;
  const result: SpikeSqlResult = { jurorId, jurorEmail, readBackMatches: false, exampleAgentReady: false, columns: {} };

  const pool = new sql.ConnectionPool({
    ...parseServer(target.server),
    database: target.database,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: { type: 'azure-active-directory-access-token', options: { token: target.token } },
  });

  try {
    await pool.connect();

    const columnRows = await pool.request().query<{
      TABLE_SCHEMA: string;
      TABLE_NAME: string;
      COLUMN_NAME: string;
      DATA_TYPE: string;
      IS_NULLABLE: string;
      COLUMN_DEFAULT: string | null;
    }>(
      `SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME IN (${ENTITY_TABLES.map((name) => `'${name}'`).join(', ')})
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    );

    const schemaByTable: Record<string, string> = {};
    for (const row of columnRows.recordset) {
      const key = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
      schemaByTable[row.TABLE_NAME] = row.TABLE_SCHEMA;
      const nullable = row.IS_NULLABLE === 'YES' ? ' null' : '';
      const defaultValue = row.COLUMN_DEFAULT ? ` default ${row.COLUMN_DEFAULT}` : '';
      (result.columns[key] ??= []).push(`${row.COLUMN_NAME} ${row.DATA_TYPE}${nullable}${defaultValue}`);
    }

    if (!schemaByTable.Juror || !schemaByTable.Agent) {
      throw new Error('Juror or Agent table not found in INFORMATION_SCHEMA.');
    }
    const jurorTable = `${quoteIdentifier(schemaByTable.Juror)}.${quoteIdentifier('Juror')}`;
    const agentTable = `${quoteIdentifier(schemaByTable.Agent)}.${quoteIdentifier('Agent')}`;

    await pool
      .request()
      .input('id', sql.UniqueIdentifier, jurorId)
      .input('email', sql.NVarChar(254), jurorEmail)
      .input('role', sql.NVarChar(20), 'expert')
      .input('team', sql.NVarChar(100), 'Spike')
      .input('active', sql.Bit, false)
      .query(`INSERT INTO ${jurorTable} (id, email, role, team, active) VALUES (@id, @email, @role, @team, @active)`);

    const readBack = await pool
      .request()
      .input('id', sql.UniqueIdentifier, jurorId)
      .query<{ id: string; email: string; role: string; team: string; active: boolean }>(
        `SELECT id, email, role, team, active FROM ${jurorTable} WHERE id = @id`,
      );
    const row = readBack.recordset[0];
    result.readBackMatches = !!row
      && String(row.id).toLowerCase() === jurorId
      && row.email === jurorEmail
      && row.role === 'expert'
      && row.team === 'Spike'
      && row.active === false;

    await pool
      .request()
      .input('id', sql.UniqueIdentifier, EXAMPLE_AGENT_ID)
      .input('name', sql.NVarChar(200), 'Sales agent (example)')
      .input('placeholder', sql.NVarChar(36), EXAMPLE_PLACEHOLDER_ID)
      .query(
        `IF NOT EXISTS (SELECT 1 FROM ${agentTable} WHERE id = @id)
           INSERT INTO ${agentTable} (id, name, workspaceId, itemId, active) VALUES (@id, @name, @placeholder, @placeholder, 1)`,
      );
    result.exampleAgentReady = true;
  } catch (error) {
    result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } finally {
    await pool.close();
  }

  return result;
}
