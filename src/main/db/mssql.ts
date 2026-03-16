import { Connection, Request } from 'tedious'
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
        encrypt: false, // Default to false for local dev to avoid econnreset on non-ssl sql servers
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
  // Clear the database from connection to connect to the server itself
  const serverConn = { ...conn, database: undefined }
  const connection = await createConnection(serverConn)
  
  return new Promise<any[]>((resolve, reject) => {
    const databases: any[] = []
    const request = new Request(`
      SELECT name 
      FROM sys.databases 
      WHERE state = 0 AND name NOT IN ('master', 'tempdb', 'model', 'msdb')
    `, (err) => {
      if (err) reject(err)
      else {
        connection.close()
        resolve(databases.map(d => ({ name: d.name, type: 'database' })))
      }
    })
    request.on('row', columns => {
      const rowData: any = {}
      columns.forEach(col => {
        rowData[col.metadata.colName] = col.value
      })
      databases.push(rowData)
    })
    connection.execSql(request)
  })
}

export async function fetchMssqlSchema(conn: DBConnection) {
  const connection = await createConnection(conn)
  
  return new Promise<any[]>((resolve, reject) => {
    const tables: any[] = []
    const request = new Request(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
    `, (err) => {
      if (err) reject(err)
      else {
        connection.close()
        resolve(tables.map(t => ({ name: t.TABLE_NAME, type: 'table' })))
      }
    })
    request.on('row', columns => {
      const rowData: any = {}
      columns.forEach(col => {
        rowData[col.metadata.colName] = col.value
      })
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
    
    // @ts-ignore - tedious event types are limited in ts definition
    request.on('columnMetadata', (columns: any[]) => {
      fields = columns.map(c => c.colName)
    })
    
    request.on('row', columns => {
      const rowData: any = {}
      columns.forEach(col => {
        rowData[col.metadata.colName] = col.value
      })
      rows.push(rowData)
    })
    connection.execSql(request)
  })
}
