import { Connection, Request, TYPES } from 'tedious'
import type { DBConnection } from '../store'

function createConnection(conn: DBConnection): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const config = {
      server: conn.host || 'localhost',
      authentication: {
        type: 'default',
        options: {
          userName: conn.user || '',
          password: conn.password || ''
        }
      },
      options: {
        port: conn.port || 1433,
        database: conn.database,
        trustServerCertificate: true,
        encrypt: !!conn.ssl,
        connectTimeout: 5000
      }
    }
    const connection = new Connection(config as any)
    connection.on('connect', err => {
      if (err) reject(err)
      else resolve(connection)
    })
    connection.connect()
  })
}

export async function testMssqlConnection(conn: DBConnection) {
  const connection = await createConnection(conn)
  connection.close()
  return true
}

export async function fetchMssqlDatabases(conn: DBConnection) {
  const serverConn = { ...conn, database: undefined }
  const connection = await createConnection(serverConn)
  return new Promise<any[]>((resolve, reject) => {
    const databases: any[] = []
    const request = new Request(`SELECT name FROM sys.databases WHERE state = 0 AND name NOT IN ('master', 'tempdb', 'model', 'msdb')`, (err) => {
      if (err) reject(err)
      else {
        connection.close()
        resolve(databases.map(d => ({ name: d.name, type: 'database' })))
      }
    })
    request.on('row', columns => {
      const rowData: any = {}
      columns.forEach(col => { rowData[col.metadata.colName] = col.value })
      databases.push(rowData)
    })
    connection.execSql(request)
  })
}

export async function fetchMssqlSchema(conn: DBConnection) {
  const connection = await createConnection(conn)
  return new Promise<any[]>((resolve, reject) => {
    const tables: any[] = []
    const request = new Request(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`, (err) => {
      if (err) reject(err)
      else {
        connection.close()
        resolve(tables.map(t => ({ name: t.TABLE_NAME, type: 'table' })))
      }
    })
    request.on('row', columns => {
      const rowData: any = {}
      columns.forEach(col => { rowData[col.metadata.colName] = col.value })
      tables.push(rowData)
    })
    connection.execSql(request)
  })
}

export async function executeMssqlQuery(conn: DBConnection, query: string, _values?: any[]) {
  const connection = await createConnection(conn)
  return new Promise<any>((resolve, reject) => {
    const rows: any[] = []
    let fields: any[] = []
    const request = new Request(query, (err) => {
      if (err) reject(err)
      else {
        connection.close()
        resolve({ rows, fields: fields.map(f => ({ name: f })) })
      }
    })
    // @ts-ignore
    request.on('columnMetadata', (columns: any[]) => { fields = columns.map(c => c.colName) })
    request.on('row', columns => {
      const rowData: any = {}
      columns.forEach(col => { rowData[col.metadata.colName] = col.value })
      rows.push(rowData)
    })
    connection.execSql(request)
  })
}

export async function fetchMssqlTableDetails(conn: DBConnection, tableName: string) {
  const connection = await createConnection(conn)
  return new Promise<any>((resolve, reject) => {
    const primaryKeys: string[] = []
    const foreignKeys: any[] = []
    const dependentTables: { table: string, column: string }[] = []
    const query = `
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = @tableName AND CONSTRAINT_NAME LIKE 'PK_%';
      SELECT COL_NAME(fc.parent_object_id, fc.parent_column_id) AS [column], OBJECT_NAME (f.referenced_object_id) AS referencedTable, COL_NAME(f.referenced_object_id, f.referenced_column_id) AS referencedColumn FROM sys.foreign_keys AS f INNER JOIN sys.foreign_key_columns AS fc ON f.OBJECT_ID = fc.constraint_object_id WHERE OBJECT_NAME(f.parent_object_id) = @tableName;
      SELECT OBJECT_NAME(f.parent_object_id) AS TableName, COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName FROM sys.foreign_keys AS f INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id WHERE OBJECT_NAME(f.referenced_object_id) = @tableName;
    `
    const request = new Request(query, (err) => {
      if (err) reject(err)
      else {
        connection.close()
        resolve({ primaryKeys, foreignKeys, dependentTables })
      }
    })
    request.addParameter('tableName', TYPES.VarChar, tableName)
    let resultSetIndex = 0
    request.on('doneInProc', () => { resultSetIndex++ })
    request.on('row', (columns) => {
      const rowData: any = {}
      columns.forEach(col => { rowData[col.metadata.colName] = col.value })
      if (resultSetIndex === 0) primaryKeys.push(rowData.COLUMN_NAME)
      else if (resultSetIndex === 1) foreignKeys.push({ column: rowData.column, referencedTable: rowData.referencedTable, referencedColumn: rowData.referencedColumn })
      else if (resultSetIndex === 2) dependentTables.push({ table: rowData.TableName, column: rowData.ColumnName })
    })
    connection.execSql(request)
  })
}

export async function insertMssqlRow(conn: DBConnection, tableName: string, row: any) {
  const connection = await createConnection(conn)
  return new Promise((resolve, reject) => {
    const columns = Object.keys(row).map(c => `[${c}]`).join(', ')
    const values = Object.values(row).map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(', ')
    const query = `INSERT INTO [${tableName}] (${columns}) VALUES (${values})`
    const request = new Request(query, (err) => {
      connection.close()
      if (err) reject(err)
      else resolve(true)
    })
    connection.execSql(request)
  })
}

export async function updateMssqlRow(conn: DBConnection, tableName: string, pkKeys: string[], oldRow: any, newRow: any) {
  const connection = await createConnection(conn)
  return new Promise((resolve, reject) => {
    const setParts = Object.entries(newRow).map(([col, val]) => {
      const value = typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val
      return `[${col}] = ${value}`
    })
    const whereParts = pkKeys.map(pk => {
      const val = oldRow[pk]
      const value = typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val
      return `[${pk}] = ${value}`
    })
    const query = `UPDATE [${tableName}] SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`
    const request = new Request(query, (err) => {
      connection.close()
      if (err) reject(err)
      else resolve(true)
    })
    connection.execSql(request)
  })
}

export async function deleteMssqlRow(conn: DBConnection, tableName: string, pkKeys: string[], row: any, cascade = false) {
  const connection = await createConnection(conn)
  return new Promise(async (resolve, reject) => {
    try {
      if (cascade) {
        const details = await fetchMssqlTableDetails(conn, tableName)
        for (const dep of details.dependentTables) {
          const pkValue = row[pkKeys[0]]
          const value = typeof pkValue === 'string' ? `'${pkValue.replace(/'/g, "''")}'` : pkValue
          const query = `DELETE FROM [${dep.table}] WHERE [${dep.column}] = ${value}`
          await new Promise((res, rej) => {
            const req = new Request(query, (e) => e ? rej(e) : res(true))
            connection.execSql(req)
          })
        }
      }
      const whereParts = pkKeys.map(pk => {
        const val = row[pk]
        const value = typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val
        return `[${pk}] = ${value}`
      })
      const query = `DELETE FROM [${tableName}] WHERE ${whereParts.join(' AND ')}`
      const request = new Request(query, (err) => {
        connection.close()
        if (err) reject(err)
        else resolve(true)
      })
      connection.execSql(request)
    } catch (e) {
      connection.close()
      reject(e)
    }
  })
}
