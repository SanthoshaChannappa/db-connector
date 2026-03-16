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

export async function fetchMysqlTableDetails(conn: DBConnection, tableName: string) {
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    connectTimeout: 5000
  })

  try {
    // 1. Get Primary Keys
    const [pkRows] = await connection.execute(`
      SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'
    `)

    // 2. Get Foreign Keys (Master tables this table points to)
    const [fkRows] = await connection.execute(`
      SELECT 
        COLUMN_NAME, 
        REFERENCED_TABLE_NAME, 
        REFERENCED_COLUMN_NAME 
      FROM 
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE 
        TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [conn.database, tableName])

    // 3. Get Dependent Tables (Tables that reference this table)
    const [depRows] = await connection.execute(`
      SELECT 
        TABLE_NAME 
      FROM 
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE 
        TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME = ?
    `, [conn.database, tableName])

    return {
      primaryKeys: (pkRows as any[]).map(r => r.Column_name),
      foreignKeys: (fkRows as any[]).map(r => ({
        column: r.COLUMN_NAME,
        referencedTable: r.REFERENCED_TABLE_NAME,
        referencedColumn: r.REFERENCED_COLUMN_NAME
      })),
      dependentTables: [...new Set((depRows as any[]).map(r => r.TABLE_NAME))]
    }
  } finally {
    await connection.end()
  }
}
