import mysql from 'mysql2/promise'
import type { DBConnection } from '../store'

export async function testMysqlConnection(conn: DBConnection) {
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database || undefined,
    port: conn.port,
    connectTimeout: 5000
    // ssl isn't specified, defaults to false mostly, but safe to add later if needed.
  })
  await connection.ping()
  await connection.end()
  return true
}

export async function fetchMysqlDatabases(conn: DBConnection) {
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    port: conn.port,
    connectTimeout: 5000
  })
  
  const [rows] = await connection.execute('SHOW DATABASES')
  await connection.end()
  
  return (rows as any[]).map(row => ({ name: row.Database, type: 'database' }))
}

export async function fetchMysqlSchema(conn: DBConnection) {
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    connectTimeout: 5000
  })
  
  const [rows] = await connection.execute('SHOW TABLES')
  await connection.end()
  
  return (rows as any[]).map(row => {
    const tableKey = Object.keys(row)[0]
    return { name: row[tableKey], type: 'table' }
  })
}

export async function executeMysqlQuery(conn: DBConnection, query: string, values?: any[]) {
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    connectTimeout: 5000
  })
  
  try {
    const [rows, fields] = await connection.execute(query, values)
    return {
      rows: rows as any[],
      fields: fields ? fields.map(f => ({ name: f.name })) : []
    }
  } finally {
    await connection.end()
  }
}
