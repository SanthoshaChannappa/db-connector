import mysql from 'mysql2/promise'
import type { DBConnection } from '../store'

export async function testMysqlConnection(conn: DBConnection) {
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database || undefined,
    port: conn.port,
    connectTimeout: 5000,
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined
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
    connectTimeout: 5000,
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined
  })

  const [rows] = await connection.execute('SHOW DATABASES')
  await connection.end()

  return (rows as any[]).map((row) => ({ name: row.Database, type: 'database' }))
}

export async function fetchMysqlSchema(conn: DBConnection) {
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    connectTimeout: 5000,
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined
  })

  const [rows] = await connection.execute('SHOW TABLES')
  await connection.end()

  return (rows as any[]).map((row) => {
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
    connectTimeout: 5000,
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined
  })

  try {
    const [rows, fields] = await connection.execute(query, values)
    return {
      rows: rows as any[],
      fields: fields ? fields.map((f) => ({ name: f.name })) : []
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
    connectTimeout: 5000,
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined
  })

  try {
    // 1. Get Primary Keys
    const [pkRows] = await connection.execute(`
      SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'
    `)

    // 2. Get Foreign Keys (Master tables this table points to)
    const [fkRows] = await connection.execute(
      `
      SELECT 
        COLUMN_NAME, 
        REFERENCED_TABLE_NAME, 
        REFERENCED_COLUMN_NAME 
      FROM 
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE 
        TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    `,
      [conn.database || '', tableName]
    )

    // 3. Get Dependent Tables (Tables that reference this table)
    const [depRows] = await connection.execute(
      `
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE REFERENCED_TABLE_NAME = ? AND REFERENCED_TABLE_SCHEMA = ?
    `,
      [tableName as any, conn.database as any]
    )

    // 4. Get Column Types
    const [columnRows] = await connection.execute(
      `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `,
      [conn.database || '', tableName]
    )

    return {
      primaryKeys: (pkRows as any[]).map((r) => r.Column_name),
      foreignKeys: (fkRows as any[]).map((r) => ({
        column: r.COLUMN_NAME,
        referencedTable: r.REFERENCED_TABLE_NAME,
        referencedColumn: r.REFERENCED_COLUMN_NAME
      })),
      dependentTables: (depRows as any[]).map((r) => ({
        table: r.TABLE_NAME,
        column: r.COLUMN_NAME
      })),
      columns: (columnRows as any[]).map((r) => ({
        name: r.COLUMN_NAME,
        type: r.DATA_TYPE,
        nullable: r.IS_NULLABLE === 'YES'
      }))
    }
  } finally {
    await connection.end()
  }
}

export async function insertMysqlRow(conn: DBConnection, tableName: string, row: any) {
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    connectTimeout: 5000,
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined
  })
  try {
    const columns = Object.keys(row)
      .map((c) => `\`${c}\``)
      .join(', ')
    const placeholders = Object.keys(row)
      .map(() => '?')
      .join(', ')
    const values = Object.values(row) as any[]
    const query = `INSERT INTO \`${tableName}\` (${columns}) VALUES (${placeholders})`
    await connection.execute(query, values)
    return true
  } finally {
    await connection.end()
  }
}

export async function updateMysqlRow(
  conn: DBConnection,
  tableName: string,
  pkKeys: string[],
  oldRow: any,
  newRow: any
) {
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    connectTimeout: 5000,
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined
  })
  try {
    const setParts: string[] = []
    const values: any[] = []

    Object.entries(newRow).forEach(([col, val]) => {
      setParts.push(`\`${col}\` = ?`)
      values.push(val)
    })

    const whereParts: string[] = []
    pkKeys.forEach((pk) => {
      whereParts.push(`\`${pk}\` = ?`)
      values.push(oldRow[pk])
    })

    const query = `UPDATE \`${tableName}\` SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`
    await connection.execute(query, values)
    return true
  } finally {
    await connection.end()
  }
}

export async function deleteMysqlRow(
  conn: DBConnection,
  tableName: string,
  pkKeys: string[],
  row: any,
  cascade = false
) {
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    connectTimeout: 5000,
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined
  })
  try {
    if (cascade) {
      const details = await fetchMysqlTableDetails(conn, tableName)
      for (const dep of details.dependentTables) {
        const pkValue = row[pkKeys[0]]
        const query = `DELETE FROM \`${dep.table}\` WHERE \`${dep.column}\` = ?`
        await connection.execute(query, [pkValue])
      }
    }

    const whereParts: string[] = []
    const values: any[] = []

    pkKeys.forEach((pk) => {
      whereParts.push(`\`${pk}\` = ?`)
      values.push(row[pk])
    })

    const query = `DELETE FROM \`${tableName}\` WHERE ${whereParts.join(' AND ')}`
    await connection.execute(query, values)
    return true
  } finally {
    await connection.end()
  }
}
