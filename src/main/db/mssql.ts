import * as mssql from 'mssql/msnodesqlv8'
import type { DBConnection } from '../store'

async function getPool(conn: DBConnection): Promise<mssql.ConnectionPool> {
  const host = conn.host || 'localhost'
  const database = conn.database || 'master'

  let config: any

  if (conn.integratedSecurity) {
    // For msnodesqlv8, Integrated Security is most reliable via connection string
    // Driver={msnodesqlv8} is the internal name for this driver in the mssql package
    const connectionString = `Driver={msnodesqlv8};Server=${host};Database=${database};Trusted_Connection=Yes;`
    config = {
      connectionString,
      options: {
        encrypt: conn.ssl ?? true,
        trustServerCertificate: true,
        connectTimeout: 10000
      }
    }
  } else {
    const hostParts = host.split('\\')
    const server = hostParts[0]
    const instanceName = hostParts[1]

    config = {
      user: conn.user,
      password: conn.password,
      server: server,
      database: database,
      options: {
        encrypt: conn.ssl ?? true,
        trustServerCertificate: true,
        connectTimeout: 10000
      }
    }

    if (instanceName) {
      config.options.instanceName = instanceName
    } else {
      config.port = conn.port || 1433
    }
  }

  return await new mssql.ConnectionPool(config).connect()
}

export async function testMssqlConnection(conn: DBConnection): Promise<boolean> {
  const pool = await getPool(conn)
  try {
    await pool.request().query('SELECT 1')
    return true
  } finally {
    await pool.close()
  }
}

export async function fetchMssqlDatabases(conn: DBConnection): Promise<any[]> {
  const serverConn = { ...conn, database: undefined }
  const pool = await getPool(serverConn)
  try {
    const result = await pool
      .request()
      .query(
        "SELECT name FROM sys.databases WHERE state = 0 AND name NOT IN ('master', 'tempdb', 'model', 'msdb')"
      )
    return result.recordset.map((row) => ({ name: row.name, type: 'database' }))
  } finally {
    await pool.close()
  }
}

export async function fetchMssqlSchema(conn: DBConnection): Promise<any[]> {
  const pool = await getPool(conn)
  try {
    const result = await pool
      .request()
      .query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
      )
    return result.recordset.map((row) => ({ name: row.TABLE_NAME, type: 'table' }))
  } finally {
    await pool.close()
  }
}

export async function executeMssqlQuery(
  conn: DBConnection,
  query: string,
  values?: any[]
): Promise<{ rows: any[]; fields: any[] }> {
  const pool = await getPool(conn)
  try {
    const request = pool.request()
    if (values) {
      values.forEach((val, i) => {
        request.input(`p${i}`, val)
      })
    }
    const result = await request.query(query)
    const fields = result.recordset.columns
      ? Object.keys(result.recordset.columns).map((name) => ({ name }))
      : []
    return {
      rows: result.recordset,
      fields
    }
  } finally {
    await pool.close()
  }
}

export async function fetchMssqlTableDetails(conn: DBConnection, tableName: string): Promise<any> {
  const pool = await getPool(conn)
  try {
    const request = pool.request()
    request.input('tableName', mssql.VarChar, tableName)

    // 1. Primary Keys
    const pkResult = await request.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = @tableName AND CONSTRAINT_NAME LIKE 'PK_%'
    `)

    // 2. Foreign Keys
    const fkResult = await request.query(`
      SELECT 
        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS [column], 
        OBJECT_NAME(fc.referenced_object_id) AS referencedTable, 
        COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS referencedColumn 
      FROM sys.foreign_keys AS f 
      INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id 
      WHERE OBJECT_NAME(f.parent_object_id) = @tableName
    `)

    // 3. Dependent Tables
    const depResult = await request.query(`
      SELECT OBJECT_NAME(f.parent_object_id) AS TableName, COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName 
      FROM sys.foreign_keys AS f 
      INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id 
      WHERE OBJECT_NAME(f.referenced_object_id) = @tableName
    `)

    // 4. Columns
    const colResult = await request.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = @tableName
    `)

    return {
      primaryKeys: pkResult.recordset.map((r) => r.COLUMN_NAME),
      foreignKeys: fkResult.recordset.map((r) => ({
        column: r.column,
        referencedTable: r.referencedTable,
        referencedColumn: r.referencedColumn
      })),
      dependentTables: depResult.recordset.map((r) => ({
        table: r.TableName,
        column: r.ColumnName
      })),
      columns: colResult.recordset.map((r) => ({
        name: r.COLUMN_NAME,
        type: r.DATA_TYPE,
        nullable: r.IS_NULLABLE === 'YES'
      }))
    }
  } finally {
    await pool.close()
  }
}

export async function insertMssqlRow(
  conn: DBConnection,
  tableName: string,
  row: Record<string, any>
): Promise<boolean> {
  const pool = await getPool(conn)
  try {
    const request = pool.request()
    const columns = Object.keys(row)
      .map((c) => `[${c}]`)
      .join(', ')
    const placeholders = Object.keys(row)
      .map((c, i) => {
        request.input(`v${i}`, row[c])
        return `@v${i}`
      })
      .join(', ')

    const query = `INSERT INTO [${tableName}] (${columns}) VALUES (${placeholders})`
    await request.query(query)
    return true
  } finally {
    await pool.close()
  }
}

export async function updateMssqlRow(
  conn: DBConnection,
  tableName: string,
  pkKeys: string[],
  oldRow: Record<string, any>,
  newRow: Record<string, any>
): Promise<boolean> {
  const pool = await getPool(conn)
  try {
    const request = pool.request()
    const setParts = Object.keys(newRow)
      .map((col, i) => {
        request.input(`nv${i}`, newRow[col])
        return `[${col}] = @nv${i}`
      })
      .join(', ')

    const whereParts = pkKeys
      .map((pk, i) => {
        request.input(`pk${i}`, oldRow[pk])
        return `[${pk}] = @pk${i}`
      })
      .join(' AND ')

    const query = `UPDATE [${tableName}] SET ${setParts} WHERE ${whereParts}`
    await request.query(query)
    return true
  } finally {
    await pool.close()
  }
}

export async function deleteMssqlRow(
  conn: DBConnection,
  tableName: string,
  pkKeys: string[],
  row: Record<string, any>,
  cascade = false
): Promise<boolean> {
  const pool = await getPool(conn)
  try {
    if (cascade) {
      const details = await fetchMssqlTableDetails(conn, tableName)
      for (const dep of details.dependentTables) {
        const pkValue = row[pkKeys[0]]
        const request = pool.request()
        request.input('pkVal', pkValue)
        const query = `DELETE FROM [${dep.table}] WHERE [${dep.column}] = @pkVal`
        await request.query(query)
      }
    }

    const request = pool.request()
    const whereParts = pkKeys
      .map((pk, i) => {
        request.input(`pk${i}`, row[pk])
        return `[${pk}] = @pk${i}`
      })
      .join(' AND ')

    const query = `DELETE FROM [${tableName}] WHERE ${whereParts}`
    await request.query(query)
    return true
  } finally {
    await pool.close()
  }
}
