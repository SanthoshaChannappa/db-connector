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
