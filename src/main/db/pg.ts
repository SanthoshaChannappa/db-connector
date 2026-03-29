import { Client } from 'pg'
import type { DBConnection } from '../store'

/**
 * Creates and configures a PostgreSQL client with necessary listeners.
 * Attaching an 'error' listener is CRITICAL to prevent uncaught exceptions
 * in the main process when connections are terminated unexpectedly (e.g., RDS Proxy timeouts).
 */
function createPgClient(conn: DBConnection) {
  const client = new Client({
    user: conn.user,
    host: conn.host,
    database: conn.database || 'postgres',
    password: conn.password,
    port: conn.port,
    connectionTimeoutMillis: 5000,
    ssl: conn.ssl ? { rejectUnauthorized: false } : false
  })

  // Prevent main process crash on unexpected connection loss
  client.on('error', (err) => {
    console.error('PostgreSQL client connection error:', err.message)
    // The error is logged but not re-thrown to avoid crashing the Electron main process
  })

  return client
}

export async function testPgConnection(conn: DBConnection) {
  const client = createPgClient(conn)
  try {
    await client.connect()
    return true
  } finally {
    await client.end().catch(() => {})
  }
}

export async function fetchPgDatabases(conn: DBConnection) {
  const client = createPgClient(conn)
  await client.connect()
  try {
    const res = await client.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datistemplate = false;
    `)
    return res.rows.map((row) => ({ name: row.datname, type: 'database' }))
  } finally {
    await client.end().catch(() => {})
  }
}

export async function fetchPgSchema(conn: DBConnection) {
  const client = createPgClient(conn)
  await client.connect()
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `)
    return res.rows.map((row) => ({ name: row.table_name, type: 'table' }))
  } finally {
    await client.end().catch(() => {})
  }
}

export async function executePgQuery(conn: DBConnection, query: string, values?: any[]) {
  const client = createPgClient(conn)
  await client.connect()
  try {
    const res = await client.query(query, values)
    return {
      rows: res.rows,
      fields: (res.fields || []).map((f) => ({ name: f.name }))
    }
  } finally {
    await client.end().catch(() => {})
  }
}

export async function fetchPgTableDetails(conn: DBConnection, tableName: string) {
  const client = createPgClient(conn)
  await client.connect()
  try {
    const pkRes = await client.query(
      `
      SELECT a.attname
      FROM   pg_index i
      JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE  i.indrelid = $1::regclass
      AND    i.indisprimary;
    `,
      [tableName]
    )

    const fkRes = await client.query(
      `
      SELECT
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name=$1;
    `,
      [tableName]
    )

    const depRes = await client.query(
      `
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY' AND ccu.table_name = $1
    `,
      [tableName]
    )

    const columnRes = await client.query(
      `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND table_schema = 'public'
    `,
      [tableName]
    )

    return {
      primaryKeys: pkRes.rows.map((r) => r.attname),
      foreignKeys: fkRes.rows.map((r) => ({
        column: r.column_name,
        referencedTable: r.foreign_table_name,
        referencedColumn: r.foreign_column_name
      })),
      dependentTables: depRes.rows.map((r) => ({ table: r.table_name, column: r.column_name })),
      columns: columnRes.rows.map((r) => ({
        name: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable === 'YES'
      }))
    }
  } finally {
    await client.end().catch(() => {})
  }
}

export async function insertPgRow(conn: DBConnection, tableName: string, row: any) {
  const client = createPgClient(conn)
  await client.connect()
  try {
    const columns = Object.keys(row)
      .map((c) => `"${c}"`)
      .join(', ')
    const placeholders = Object.keys(row)
      .map((_, i) => `$${i + 1}`)
      .join(', ')
    const values = Object.values(row)
    const query = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`
    await client.query(query, values)
    return true
  } finally {
    await client.end().catch(() => {})
  }
}

export async function updatePgRow(
  conn: DBConnection,
  tableName: string,
  pkKeys: string[],
  oldRow: any,
  newRow: any
) {
  const client = createPgClient(conn)
  await client.connect()
  try {
    const setParts: string[] = []
    const values: any[] = []
    let i = 1
    Object.entries(newRow).forEach(([col, val]) => {
      setParts.push(`"${col}" = $${i++}`)
      values.push(val)
    })
    const whereParts: string[] = []
    pkKeys.forEach((pk) => {
      whereParts.push(`"${pk}" = $${i++}`)
      values.push(oldRow[pk])
    })
    const query = `UPDATE "${tableName}" SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`
    await client.query(query, values)
    return true
  } finally {
    await client.end().catch(() => {})
  }
}

export async function deletePgRow(
  conn: DBConnection,
  tableName: string,
  pkKeys: string[],
  row: any,
  cascade = false
) {
  const client = createPgClient(conn)
  await client.connect()
  try {
    if (cascade) {
      const details = await fetchPgTableDetails(conn, tableName)
      for (const dep of details.dependentTables) {
        const pkValue = row[pkKeys[0]]
        const query = `DELETE FROM "${dep.table}" WHERE "${dep.column}" = $1`
        await client.query(query, [pkValue])
      }
    }
    const whereParts: string[] = []
    const values: any[] = []
    let i = 1
    pkKeys.forEach((pk) => {
      whereParts.push(`"${pk}" = $${i++}`)
      values.push(row[pk])
    })
    const query = `DELETE FROM "${tableName}" WHERE ${whereParts.join(' AND ')}`
    await client.query(query, values)
    return true
  } finally {
    await client.end().catch(() => {})
  }
}
