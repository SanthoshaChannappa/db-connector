import { Client } from 'pg'
import type { DBConnection } from '../store'

export async function testPgConnection(conn: DBConnection) {
  const client = new Client({
    user: conn.user,
    host: conn.host,
    database: conn.database,
    password: conn.password,
    port: conn.port,
    connectionTimeoutMillis: 5000,
    ssl: false
  })
  await client.connect()
  await client.end()
  return true
}

export async function fetchPgDatabases(conn: DBConnection) {
  const client = new Client({
    user: conn.user,
    host: conn.host,
    password: conn.password,
    port: conn.port,
    connectionTimeoutMillis: 5000,
    ssl: false
  })
  // Usually connect to 'postgres' database to list all databases
  client.database = 'postgres'
  
  await client.connect()
  const res = await client.query(`
    SELECT datname 
    FROM pg_database 
    WHERE datistemplate = false;
  `)
  await client.end()
  return res.rows.map(row => ({ name: row.datname, type: 'database' }))
}

export async function fetchPgSchema(conn: DBConnection) {
  const client = new Client({
    user: conn.user,
    host: conn.host,
    database: conn.database,
    password: conn.password,
    port: conn.port,
    connectionTimeoutMillis: 5000,
    ssl: false
  })
  await client.connect()
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `)
  await client.end()
  return res.rows.map(row => ({ name: row.table_name, type: 'table' }))
}

export async function executePgQuery(conn: DBConnection, query: string, values?: any[]) {
  const client = new Client({
    user: conn.user,
    host: conn.host,
    database: conn.database,
    password: conn.password,
    port: conn.port,
    connectionTimeoutMillis: 5000,
    ssl: false
  })
  await client.connect()
  try {
    const res = await client.query(query, values)
    return {
      rows: res.rows,
      fields: res.fields.map(f => ({ name: f.name }))
    }
  } finally {
    await client.end()
  }
}

export async function fetchPgTableDetails(conn: DBConnection, tableName: string) {
  const client = new Client({
    user: conn.user,
    host: conn.host,
    database: conn.database,
    password: conn.password,
    port: conn.port,
    connectionTimeoutMillis: 5000,
    ssl: false
  })
  await client.connect()
  try {
    // 1. Get Primary Keys
    const pkRes = await client.query(`
      SELECT a.attname
      FROM   pg_index i
      JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE  i.indrelid = $1::regclass
      AND    i.indisprimary;
    `, [tableName])

    // 2. Get Foreign Keys (Master tables this table points to)
    const fkRes = await client.query(`
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
    `, [tableName])

    // 3. Get Dependent Tables (Tables that reference this table)
    const depRes = await client.query(`
      SELECT
          tc.table_name
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name=$1;
    `, [tableName])

    return {
      primaryKeys: pkRes.rows.map(r => r.attname),
      foreignKeys: fkRes.rows.map(r => ({
        column: r.column_name,
        referencedTable: r.foreign_table_name,
        referencedColumn: r.foreign_column_name
      })),
      dependentTables: [...new Set(depRes.rows.map(r => r.table_name))]
    }
  } finally {
    await client.end()
  }
}
